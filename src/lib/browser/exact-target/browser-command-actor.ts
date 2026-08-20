import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import type { AuthenticatedBrowserAuthority } from "../infrastructure/browser-authority-certificate.js";
import type { BrowserExecutionBinding } from "../browser-authority-api.js";
import {
  capabilityIdForCommand,
  GRASSEYE_BROWSER_HOST_TO_EXTENSION_CONTROL_MAX_BYTES,
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  GRASSEYE_BROWSER_RELEASE_IDENTITY,
  type BrowserWireCommand,
  type BrowserWireMessage,
  type BrowserWireMutationClass,
  type BrowserWireResponsePayload,
} from "../protocol/generated/browser-protocol.js";
import { BrowserCommandAdmissionBudget } from "../transport/browser-command-admission-budget.js";
import { issueBrowserCommandPermit } from "../transport/command-permit.js";
import { decryptBrowserFrame, encryptBrowserFrame } from "../transport/transport-frame-crypto.js";
import type { ReplyChannelToken } from "../transport/reply-channel-token.js";
import type { BrowserArtifactStreamReceiver } from "./browser-artifact-stream.js";
import { BrowserMutationIntentJournal } from "./browser-mutation-intent-journal.js";
import { BrowserTerminalError } from "./browser-command-contract.js";

const monotonicEpochMs = (): number => performance.timeOrigin + performance.now();
const hashPayload = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

export type BrowserCommandActorTransport = {
  requireAuthority(): AuthenticatedBrowserAuthority;
  requireFrameKey(authority: AuthenticatedBrowserAuthority): Buffer;
  currentReplyChannel(authority: AuthenticatedBrowserAuthority): ReplyChannelToken;
  isCurrent(input: { authorityRef: string; authorityEpoch: number; replyChannelToken: string }): boolean;
  send(message: BrowserWireMessage): void;
  terminate(reason: string): void;
};

type PendingCommand = {
  commandId: string;
  permitHash: `sha256:${string}`;
  authorityRef: string;
  authorityEpoch: number;
  authorityCertificateHash: `sha256:${string}`;
  replyChannelToken: string;
  sequence: number;
  mutationClass: BrowserWireMutationClass;
  executionFenceHash: `sha256:${string}`;
  requestPayloadHash: `sha256:${string}`;
  resolve(value: unknown): void;
  reject(error: Error): void;
  timeout: NodeJS.Timeout;
  releaseAdmission(): void;
};

export class BrowserCommandActor {
  private readonly pending = new Map<string, PendingCommand>();
  private readonly admission = new BrowserCommandAdmissionBudget();
  private readonly journal: BrowserMutationIntentJournal;
  private nextSequence = 1;

  constructor(
    dataDir: string,
    private readonly transport: BrowserCommandActorTransport,
    private readonly artifacts: BrowserArtifactStreamReceiver,
  ) {
    this.journal = new BrowserMutationIntentJournal(dataDir);
  }

  async command<T>(input: {
    executionBinding: BrowserExecutionBinding;
    targetLeaseRef: string;
    documentRef: string;
    command: BrowserWireCommand;
    expectedLoaderId?: string;
    mutationClass: BrowserWireMutationClass;
    timeoutMs?: number;
    abortSignal?: AbortSignal;
  }): Promise<{ commandId: string; result: T }> {
    const timeoutMs = input.timeoutMs ?? 10_000;
    const authority = this.transport.requireAuthority();
    const frameKey = this.transport.requireFrameKey(authority);
    const reply = this.transport.currentReplyChannel(authority);
    const commandId = randomUUID();
    const sequence = this.nextSequence++;
    const deadlineMonotonicMs = monotonicEpochMs() + timeoutMs;
    const wirePayload = Object.freeze({
      commandId,
      mutationClass: input.mutationClass,
      ...(input.expectedLoaderId ? { expectedLoaderId: input.expectedLoaderId } : {}),
      command: input.command,
    });
    const requestPayloadHash = hashPayload(wirePayload);
    const releaseAdmission = this.admission.admit({
      commandId,
      targetLeaseRef: input.targetLeaseRef,
      mutationClass: input.mutationClass,
      payloadBytes: Buffer.byteLength(JSON.stringify(wirePayload), "utf8"),
      deadlineMonotonicMs,
    }, monotonicEpochMs());

    const permit = issueBrowserCommandPermit({
      authority,
      activationTupleHash: authority.certificate.activationTupleHash,
      replyChannel: reply,
      capabilityId: capabilityIdForCommand(input.command),
      executionBinding: input.executionBinding,
      targetLeaseRef: input.targetLeaseRef,
      documentRef: input.documentRef,
      commandId,
      sequence,
      deadlineMonotonicMs,
      mutationClass: input.mutationClass,
    });
    const encrypted = encryptBrowserFrame(frameKey, {
      authorityRef: permit.authorityRef,
      authorityEpoch: permit.authorityEpoch,
      replyChannelToken: permit.replyChannelToken,
      sequence: permit.sequence,
      permitHash: permit.permitHash,
    }, wirePayload);
    const frame: BrowserWireMessage = {
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "command_frame",
      permit,
      ...encrypted,
    };
    if (Buffer.byteLength(JSON.stringify(frame), "utf8") > GRASSEYE_BROWSER_HOST_TO_EXTENSION_CONTROL_MAX_BYTES) {
      releaseAdmission();
      throw new BrowserTerminalError(
        "BROWSER_BACKPRESSURE",
        "browser command control frame exceeds 256KiB",
        input.mutationClass,
      );
    }

    if (input.mutationClass !== "observation") {
      await this.journal.prepare({
        commandId,
        authorityCertificateHash: authority.certificate.certificateHash,
        executionFenceHash: input.executionBinding.writerFenceHash,
        mutationClass: input.mutationClass,
        payload: wirePayload,
      });
    }

    const response = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const pending = this.pending.get(commandId);
        if (!pending) return;
        this.pending.delete(commandId);
        pending.releaseAdmission();
        void this.recordUncertain(pending);
        reject(new BrowserTerminalError(
          input.mutationClass === "non_idempotent_mutation" ? "OUTCOME_UNKNOWN" : "COMMAND_TIMEOUT",
          `command ${commandId} deadline elapsed`,
          input.mutationClass,
        ));
      }, timeoutMs);
      this.pending.set(commandId, {
        commandId,
        permitHash: permit.permitHash,
        authorityRef: permit.authorityRef,
        authorityEpoch: permit.authorityEpoch,
        authorityCertificateHash: permit.authorityCertificateHash,
        replyChannelToken: permit.replyChannelToken,
        sequence,
        mutationClass: input.mutationClass,
        executionFenceHash: input.executionBinding.writerFenceHash,
        requestPayloadHash,
        resolve,
        reject,
        timeout,
        releaseAdmission,
      });
    });

    const abort = (): void => this.abort(commandId);
    input.abortSignal?.addEventListener("abort", abort, { once: true });
    try {
      if (!this.transport.isCurrent({
        authorityRef: permit.authorityRef,
        authorityEpoch: permit.authorityEpoch,
        replyChannelToken: permit.replyChannelToken,
      })) {
        throw new BrowserTerminalError(
          "TRANSPORT_DISCONNECTED",
          "command authority changed before send",
          input.mutationClass,
        );
      }
      this.transport.send(frame);
      return { commandId, result: await response as T };
    } catch (error) {
      const pending = this.pending.get(commandId);
      if (pending) {
        this.pending.delete(commandId);
        clearTimeout(pending.timeout);
        pending.releaseAdmission();
        await this.recordUncertain(pending);
      }
      throw error;
    } finally {
      input.abortSignal?.removeEventListener("abort", abort);
    }
  }

  async handleResponse(
    value: Extract<BrowserWireMessage, { type: "response_frame" }>,
    frameKey: Buffer,
  ): Promise<void> {
    const pending = [...this.pending.values()]
      .find((item) => item.permitHash === value.permitHash);
    if (!pending) return;
    if (
      value.replyChannelToken !== pending.replyChannelToken
      || value.authorityRef !== pending.authorityRef
      || value.authorityEpoch !== pending.authorityEpoch
      || value.sequence !== pending.sequence
      || !this.transport.isCurrent({
        authorityRef: pending.authorityRef,
        authorityEpoch: pending.authorityEpoch,
        replyChannelToken: pending.replyChannelToken,
      })
    ) {
      this.rejectAndTerminate(pending, "browser response binding mismatch");
      return;
    }

    let response: BrowserWireResponsePayload;
    try {
      response = decryptBrowserFrame<BrowserWireResponsePayload>(frameKey, {
        authorityRef: pending.authorityRef,
        authorityEpoch: pending.authorityEpoch,
        replyChannelToken: pending.replyChannelToken,
        sequence: pending.sequence,
        permitHash: pending.permitHash,
      }, value);
    } catch {
      this.rejectAndTerminate(pending, "browser response frame authentication failed");
      return;
    }
    if (response.commandId !== pending.commandId) {
      this.rejectAndTerminate(pending, "browser response command id mismatch");
      return;
    }

    clearTimeout(pending.timeout);
    this.pending.delete(pending.commandId);
    pending.releaseAdmission();
    if (response.ok) {
      if (pending.mutationClass !== "observation") {
        await this.recordTerminal(pending, "TERMINAL_SUCCESS");
      }
      const result = response.result as {
        artifactRef?: unknown;
        contentHash?: unknown;
        byteLength?: unknown;
      } | undefined;
      if (
        result
        && typeof result.artifactRef === "string"
        && typeof result.contentHash === "string"
        && typeof result.byteLength === "number"
      ) {
        const receipt = await this.artifacts.finalize({
          artifactRef: result.artifactRef,
          contentHash: result.contentHash as `sha256:${string}`,
          byteLength: result.byteLength,
        });
        pending.resolve({ ...result, artifactReceipt: receipt });
      } else {
        pending.resolve(response.result);
      }
      return;
    }

    if (pending.mutationClass !== "observation") {
      await this.recordTerminal(
        pending,
        pending.mutationClass === "non_idempotent_mutation"
          ? "OUTCOME_UNKNOWN"
          : "TERMINAL_FAILURE",
      );
    }
    pending.reject(new BrowserTerminalError(
      pending.mutationClass === "non_idempotent_mutation"
        ? "OUTCOME_UNKNOWN"
        : "TRANSPORT_DISCONNECTED",
      response.errorMessage ?? response.errorCode ?? "browser command failed",
      pending.mutationClass,
    ));
  }

  failPending(reason: string): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.releaseAdmission();
      void this.recordUncertain(pending);
      pending.reject(new BrowserTerminalError(
        pending.mutationClass === "non_idempotent_mutation"
          ? "OUTCOME_UNKNOWN"
          : "TRANSPORT_DISCONNECTED",
        reason,
        pending.mutationClass,
      ));
    }
    this.pending.clear();
  }

  resetSequence(): void { this.nextSequence = 1; }

  private abort(commandId: string): void {
    const pending = this.pending.get(commandId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(commandId);
    pending.releaseAdmission();
    void this.recordUncertain(pending);
    pending.reject(new BrowserTerminalError(
      pending.mutationClass === "non_idempotent_mutation"
        ? "OUTCOME_UNKNOWN"
        : "COMMAND_TIMEOUT",
      "browser command aborted",
      pending.mutationClass,
    ));
  }

  private rejectAndTerminate(pending: PendingCommand, reason: string): void {
    clearTimeout(pending.timeout);
    this.pending.delete(pending.commandId);
    pending.releaseAdmission();
    void this.recordUncertain(pending);
    pending.reject(new BrowserTerminalError(
      pending.mutationClass === "non_idempotent_mutation"
        ? "OUTCOME_UNKNOWN"
        : "TRANSPORT_DISCONNECTED",
      reason,
      pending.mutationClass,
    ));
    this.transport.terminate(reason);
  }

  private recordTerminal(
    pending: PendingCommand,
    state: "TERMINAL_SUCCESS" | "TERMINAL_FAILURE" | "OUTCOME_UNKNOWN",
  ): Promise<void> {
    if (pending.mutationClass === "observation") return Promise.resolve();
    return this.journal.terminal({
      commandId: pending.commandId,
      authorityCertificateHash: pending.authorityCertificateHash,
      executionFenceHash: pending.executionFenceHash,
      mutationClass: pending.mutationClass,
      payloadHash: pending.requestPayloadHash,
      state,
    });
  }

  private recordUncertain(pending: PendingCommand): Promise<void> {
    if (pending.mutationClass === "observation") return Promise.resolve();
    return this.journal.terminal({
      commandId: pending.commandId,
      authorityCertificateHash: pending.authorityCertificateHash,
      executionFenceHash: pending.executionFenceHash,
      mutationClass: pending.mutationClass,
      payloadHash: pending.requestPayloadHash,
      state: pending.mutationClass === "non_idempotent_mutation"
        ? "OUTCOME_UNKNOWN"
        : "TERMINAL_FAILURE",
    }).catch(() => undefined);
  }
}
