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
import { encryptBrowserFrame } from "../transport/transport-frame-crypto.js";
import type { ReplyChannelToken } from "../transport/reply-channel-token.js";
import type { BrowserArtifactStreamReceiver } from "./browser-artifact-stream.js";
import { BrowserMutationIntentJournal } from "./browser-mutation-intent-journal.js";
import { BrowserTerminalError } from "./browser-command-contract.js";
import { BrowserCommandResponseHandler } from "./browser-command-response-handler.js";

const monotonicEpochMs = (): number =>
  performance.timeOrigin + performance.now();
const hashPayload = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

export type BrowserCommandActorTransport = {
  requireAuthority(): AuthenticatedBrowserAuthority;
  requireFrameKey(authority: AuthenticatedBrowserAuthority): Buffer;
  currentReplyChannel(
    authority: AuthenticatedBrowserAuthority,
  ): ReplyChannelToken;
  isCurrent(input: {
    authorityRef: string;
    authorityEpoch: number;
    replyChannelToken: string;
  }): boolean;
  send(message: BrowserWireMessage): void;
  terminate(reason: string): void;
};

export type PendingCommand = {
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

type BrowserCommandInput = Readonly<{
  executionBinding: BrowserExecutionBinding;
  targetLeaseRef: string;
  documentRef: string;
  command: BrowserWireCommand;
  expectedLoaderId?: string;
  mutationClass: BrowserWireMutationClass;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}>;

type PreparedBrowserCommand = Readonly<{
  input: BrowserCommandInput;
  timeoutMs: number;
  authority: AuthenticatedBrowserAuthority;
  commandId: string;
  sequence: number;
  wirePayload: Readonly<Record<string, unknown>>;
  requestPayloadHash: `sha256:${string}`;
  permit: ReturnType<typeof issueBrowserCommandPermit>;
  frame: BrowserWireMessage;
  releaseAdmission: () => void;
}>;

export class BrowserCommandActor {
  private readonly pending = new Map<string, PendingCommand>();
  private readonly admission = new BrowserCommandAdmissionBudget();
  private readonly journal: BrowserMutationIntentJournal;
  private readonly responses: BrowserCommandResponseHandler;
  private nextSequence = 1;

  constructor(
    dataDir: string,
    private readonly transport: BrowserCommandActorTransport,
    private readonly artifacts: BrowserArtifactStreamReceiver,
  ) {
    this.journal = new BrowserMutationIntentJournal(dataDir);
    this.responses = new BrowserCommandResponseHandler({
      pending: this.pending,
      transport,
      artifacts,
      journal: this.journal,
    });
  }

  async command<T>(
    input: BrowserCommandInput,
  ): Promise<{ commandId: string; result: T }> {
    const prepared = this.prepareCommand(input);
    const abort = (): void => this.abort(prepared.commandId);
    input.abortSignal?.addEventListener("abort", abort, { once: true });
    try {
      await this.prepareMutationJournal(prepared);
      const response = this.registerPending(prepared);
      return await this.sendAndAwait<T>(prepared, response);
    } catch (error) {
      await this.discardPending(prepared.commandId);
      throw error;
    } finally {
      input.abortSignal?.removeEventListener("abort", abort);
    }
  }

  private prepareCommand(input: BrowserCommandInput): PreparedBrowserCommand {
    const identity = this.commandIdentity(input);
    const wirePayload = this.commandPayload(input, identity.commandId);
    const releaseAdmission = this.admit(input, identity.commandId, wirePayload);
    try {
      return this.frameCommand(input, identity, wirePayload, releaseAdmission);
    } catch (error) {
      releaseAdmission();
      throw error;
    }
  }

  private commandIdentity(input: BrowserCommandInput): Readonly<{
    authority: AuthenticatedBrowserAuthority;
    frameKey: Buffer;
    reply: ReplyChannelToken;
    commandId: string;
    sequence: number;
    timeoutMs: number;
    deadlineMonotonicMs: number;
  }> {
    const timeoutMs = input.timeoutMs ?? 10_000;
    const authority = this.transport.requireAuthority();
    const frameKey = this.transport.requireFrameKey(authority);
    const reply = this.transport.currentReplyChannel(authority);
    const commandId = randomUUID();
    const sequence = this.nextSequence++;
    const deadlineMonotonicMs = monotonicEpochMs() + timeoutMs;
    return Object.freeze({
      authority,
      frameKey,
      reply,
      commandId,
      sequence,
      timeoutMs,
      deadlineMonotonicMs,
    });
  }

  private commandPayload(
    input: BrowserCommandInput,
    commandId: string,
  ): Readonly<Record<string, unknown>> {
    return Object.freeze({
      commandId,
      mutationClass: input.mutationClass,
      ...(input.expectedLoaderId
        ? { expectedLoaderId: input.expectedLoaderId }
        : {}),
      command: input.command,
    });
  }

  private admit(
    input: BrowserCommandInput,
    commandId: string,
    wirePayload: Readonly<Record<string, unknown>>,
  ): () => void {
    return this.admission.admit(
      {
        commandId,
        targetLeaseRef: input.targetLeaseRef,
        mutationClass: input.mutationClass,
        payloadBytes: Buffer.byteLength(JSON.stringify(wirePayload), "utf8"),
        deadlineMonotonicMs: monotonicEpochMs() + (input.timeoutMs ?? 10_000),
      },
      monotonicEpochMs(),
    );
  }

  private frameCommand(
    input: BrowserCommandInput,
    identity: ReturnType<BrowserCommandActor["commandIdentity"]>,
    wirePayload: Readonly<Record<string, unknown>>,
    releaseAdmission: () => void,
  ): PreparedBrowserCommand {
    const permit = issueBrowserCommandPermit({
      authority: identity.authority,
      activationTupleHash: identity.authority.certificate.activationTupleHash,
      replyChannel: identity.reply,
      capabilityId: capabilityIdForCommand(input.command),
      executionBinding: input.executionBinding,
      targetLeaseRef: input.targetLeaseRef,
      documentRef: input.documentRef,
      commandId: identity.commandId,
      sequence: identity.sequence,
      deadlineMonotonicMs: identity.deadlineMonotonicMs,
      mutationClass: input.mutationClass,
    });
    const frame = this.encryptedFrame(identity.frameKey, permit, {
      ...wirePayload,
    });
    if (
      Buffer.byteLength(JSON.stringify(frame), "utf8") >
      GRASSEYE_BROWSER_HOST_TO_EXTENSION_CONTROL_MAX_BYTES
    ) {
      throw new BrowserTerminalError(
        "BROWSER_BACKPRESSURE",
        "browser command control frame exceeds 256KiB",
        input.mutationClass,
      );
    }
    return Object.freeze({
      input,
      timeoutMs: identity.timeoutMs,
      authority: identity.authority,
      commandId: identity.commandId,
      sequence: identity.sequence,
      wirePayload,
      requestPayloadHash: hashPayload(wirePayload),
      permit,
      frame,
      releaseAdmission,
    });
  }

  private encryptedFrame(
    frameKey: Buffer,
    permit: ReturnType<typeof issueBrowserCommandPermit>,
    wirePayload: Readonly<Record<string, unknown>>,
  ): BrowserWireMessage {
    const encrypted = encryptBrowserFrame(
      frameKey,
      {
        authorityRef: permit.authorityRef,
        authorityEpoch: permit.authorityEpoch,
        replyChannelToken: permit.replyChannelToken,
        sequence: permit.sequence,
        permitHash: permit.permitHash,
      },
      wirePayload,
    );
    return {
      protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
      releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
      type: "command_frame",
      permit,
      ...encrypted,
    };
  }

  private async prepareMutationJournal(
    prepared: PreparedBrowserCommand,
  ): Promise<void> {
    if (prepared.input.mutationClass === "observation") return;
    await this.journal.prepare({
      commandId: prepared.commandId,
      authorityCertificateHash: prepared.authority.certificate.certificateHash,
      executionFenceHash: prepared.input.executionBinding.writerFenceHash,
      mutationClass: prepared.input.mutationClass,
      payload: prepared.wirePayload,
    });
  }

  private registerPending(prepared: PreparedBrowserCommand): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const pending = this.pending.get(prepared.commandId);
        if (!pending) return;
        this.pending.delete(prepared.commandId);
        pending.releaseAdmission();
        void this.recordUncertain(pending);
        reject(
          new BrowserTerminalError(
            prepared.input.mutationClass === "non_idempotent_mutation"
              ? "OUTCOME_UNKNOWN"
              : "COMMAND_TIMEOUT",
            `command ${prepared.commandId} deadline elapsed`,
            prepared.input.mutationClass,
          ),
        );
      }, prepared.timeoutMs);
      this.pending.set(prepared.commandId, {
        commandId: prepared.commandId,
        permitHash: prepared.permit.permitHash,
        authorityRef: prepared.permit.authorityRef,
        authorityEpoch: prepared.permit.authorityEpoch,
        authorityCertificateHash: prepared.permit.authorityCertificateHash,
        replyChannelToken: prepared.permit.replyChannelToken,
        sequence: prepared.sequence,
        mutationClass: prepared.input.mutationClass,
        executionFenceHash: prepared.input.executionBinding.writerFenceHash,
        requestPayloadHash: prepared.requestPayloadHash,
        resolve,
        reject,
        timeout,
        releaseAdmission: prepared.releaseAdmission,
      });
    });
  }

  private async sendAndAwait<T>(
    prepared: PreparedBrowserCommand,
    response: Promise<unknown>,
  ): Promise<{ commandId: string; result: T }> {
    if (
      !this.transport.isCurrent({
        authorityRef: prepared.permit.authorityRef,
        authorityEpoch: prepared.permit.authorityEpoch,
        replyChannelToken: prepared.permit.replyChannelToken,
      })
    ) {
      throw new BrowserTerminalError(
        "TRANSPORT_DISCONNECTED",
        "command authority changed before send",
        prepared.input.mutationClass,
      );
    }
    this.transport.send(prepared.frame);
    return { commandId: prepared.commandId, result: (await response) as T };
  }

  private async discardPending(commandId: string): Promise<void> {
    const pending = this.pending.get(commandId);
    if (!pending) return;
    this.pending.delete(commandId);
    clearTimeout(pending.timeout);
    pending.releaseAdmission();
    await this.recordUncertain(pending);
  }

  async handleResponse(
    value: Extract<BrowserWireMessage, { type: "response_frame" }>,
    frameKey: Buffer,
  ): Promise<void> {
    await this.responses.handleResponse(value, frameKey);
  }

  failPending(reason: string): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.releaseAdmission();
      void this.recordUncertain(pending);
      pending.reject(
        new BrowserTerminalError(
          pending.mutationClass === "non_idempotent_mutation"
            ? "OUTCOME_UNKNOWN"
            : "TRANSPORT_DISCONNECTED",
          reason,
          pending.mutationClass,
        ),
      );
    }
    this.pending.clear();
  }

  resetSequence(): void {
    this.nextSequence = 1;
  }

  private abort(commandId: string): void {
    const pending = this.pending.get(commandId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(commandId);
    pending.releaseAdmission();
    void this.recordUncertain(pending);
    pending.reject(
      new BrowserTerminalError(
        pending.mutationClass === "non_idempotent_mutation"
          ? "OUTCOME_UNKNOWN"
          : "COMMAND_TIMEOUT",
        "browser command aborted",
        pending.mutationClass,
      ),
    );
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
    return this.journal
      .terminal({
        commandId: pending.commandId,
        authorityCertificateHash: pending.authorityCertificateHash,
        executionFenceHash: pending.executionFenceHash,
        mutationClass: pending.mutationClass,
        payloadHash: pending.requestPayloadHash,
        state:
          pending.mutationClass === "non_idempotent_mutation"
            ? "OUTCOME_UNKNOWN"
            : "TERMINAL_FAILURE",
      })
      .catch(() => undefined);
  }
}
