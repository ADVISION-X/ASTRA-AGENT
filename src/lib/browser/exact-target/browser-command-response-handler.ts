import type {
  BrowserWireMessage,
  BrowserWireResponsePayload,
} from "../protocol/generated/browser-protocol.js";
import { decryptBrowserFrame } from "../transport/transport-frame-crypto.js";
import type { BrowserArtifactStreamReceiver } from "./browser-artifact-stream.js";
import { BrowserMutationIntentJournal } from "./browser-mutation-intent-journal.js";
import { BrowserTerminalError } from "./browser-command-contract.js";
import type {
  BrowserCommandActorTransport,
  PendingCommand,
} from "./browser-command-actor.js";

export class BrowserCommandResponseHandler {
  constructor(
    private readonly input: {
      pending: Map<string, PendingCommand>;
      transport: BrowserCommandActorTransport;
      artifacts: BrowserArtifactStreamReceiver;
      journal: BrowserMutationIntentJournal;
    },
  ) {}

  async handleResponse(
    value: Extract<BrowserWireMessage, { type: "response_frame" }>,
    frameKey: Buffer,
  ): Promise<void> {
    const pending = [...this.input.pending.values()].find(
      (item) => item.permitHash === value.permitHash,
    );
    if (!pending) return;
    if (!this.bindingMatches(value, pending)) {
      this.rejectAndTerminate(pending, "browser response binding mismatch");
      return;
    }
    const response = this.decryptResponse(value, frameKey, pending);
    if (!response) return;
    if (response.commandId !== pending.commandId) {
      this.rejectAndTerminate(pending, "browser response command id mismatch");
      return;
    }
    this.settlePending(pending);
    if (response.ok) return this.resolveSuccess(pending, response);
    await this.rejectFailure(pending, response);
  }

  private bindingMatches(
    value: Extract<BrowserWireMessage, { type: "response_frame" }>,
    pending: PendingCommand,
  ): boolean {
    return (
      value.replyChannelToken === pending.replyChannelToken &&
      value.authorityRef === pending.authorityRef &&
      value.authorityEpoch === pending.authorityEpoch &&
      value.sequence === pending.sequence &&
      this.input.transport.isCurrent({
        authorityRef: pending.authorityRef,
        authorityEpoch: pending.authorityEpoch,
        replyChannelToken: pending.replyChannelToken,
      })
    );
  }

  private decryptResponse(
    value: Extract<BrowserWireMessage, { type: "response_frame" }>,
    frameKey: Buffer,
    pending: PendingCommand,
  ): BrowserWireResponsePayload | null {
    try {
      return decryptBrowserFrame<BrowserWireResponsePayload>(
        frameKey,
        {
          authorityRef: pending.authorityRef,
          authorityEpoch: pending.authorityEpoch,
          replyChannelToken: pending.replyChannelToken,
          sequence: pending.sequence,
          permitHash: pending.permitHash,
        },
        value,
      );
    } catch {
      this.rejectAndTerminate(
        pending,
        "browser response frame authentication failed",
      );
      return null;
    }
  }

  private settlePending(pending: PendingCommand): void {
    clearTimeout(pending.timeout);
    this.input.pending.delete(pending.commandId);
    pending.releaseAdmission();
  }

  private async resolveSuccess(
    pending: PendingCommand,
    response: BrowserWireResponsePayload,
  ): Promise<void> {
    if (pending.mutationClass !== "observation") {
      await this.recordTerminal(pending, "TERMINAL_SUCCESS");
    }
    const result = response.result as ArtifactResult | undefined;
    if (!isArtifactResult(result)) return pending.resolve(response.result);
    const receipt = await this.input.artifacts.finalize(result);
    pending.resolve({ ...result, artifactReceipt: receipt });
  }

  private async rejectFailure(
    pending: PendingCommand,
    response: BrowserWireResponsePayload,
  ): Promise<void> {
    if (pending.mutationClass !== "observation") {
      await this.recordTerminal(
        pending,
        pending.mutationClass === "non_idempotent_mutation"
          ? "OUTCOME_UNKNOWN"
          : "TERMINAL_FAILURE",
      );
    }
    pending.reject(
      new BrowserTerminalError(
        pending.mutationClass === "non_idempotent_mutation"
          ? "OUTCOME_UNKNOWN"
          : "TRANSPORT_DISCONNECTED",
        response.errorMessage ?? response.errorCode ?? "browser command failed",
        pending.mutationClass,
      ),
    );
  }

  private rejectAndTerminate(pending: PendingCommand, reason: string): void {
    this.settlePending(pending);
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
    this.input.transport.terminate(reason);
  }

  private recordTerminal(
    pending: PendingCommand,
    state: "TERMINAL_SUCCESS" | "TERMINAL_FAILURE" | "OUTCOME_UNKNOWN",
  ): Promise<void> {
    if (pending.mutationClass === "observation") return Promise.resolve();
    return this.input.journal.terminal({
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
    return this.recordTerminal(
      pending,
      pending.mutationClass === "non_idempotent_mutation"
        ? "OUTCOME_UNKNOWN"
        : "TERMINAL_FAILURE",
    ).catch(() => undefined);
  }
}

type ArtifactResult = {
  artifactRef?: unknown;
  contentHash?: unknown;
  byteLength?: unknown;
};

const isArtifactResult = (
  value: ArtifactResult | undefined,
): value is {
  artifactRef: string;
  contentHash: `sha256:${string}`;
  byteLength: number;
} => {
  if (!value) return false;
  return (
    typeof value.artifactRef === "string" &&
    typeof value.contentHash === "string" &&
    typeof value.byteLength === "number"
  );
};
