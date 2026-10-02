import type { BrowserExecutionBinding } from "./browser-authority-broker.js";
import { BrowserAuthorityBroker } from "./browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "./browser-authority-issuer.js";
import type { createBrowserInfrastructureState } from "./browser-infrastructure-state.js";
import { BrowserAuthorityWebSocket } from "../transport/browser-authority-websocket.js";
import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS } from "../protocol/generated/browser-protocol.generated.js";
import type { BrowserTargetLeaseWait, BrowserTargetReleaseAuthority } from "../exact-target/browser-target-lease.js";

type TargetWaiter = Readonly<{
  binding: BrowserExecutionBinding;
  targetMode: BrowserTargetLeaseWait["targetMode"];
  remainingMs(): number;
}>;
type LaneState = ReturnType<typeof createBrowserInfrastructureState>;

export class BrowserTargetAcquirer {
  public constructor(
    private readonly resolveBroker: () => BrowserAuthorityBroker,
    private readonly websocket: BrowserAuthorityWebSocket,
    private readonly issuer: BrowserAuthorityIssuer,
    private readonly infrastructure: LaneState,
  ) {}

  public async ensureAvailableTarget(
    waiter: TargetWaiter,
    parentConversationUrl?: string,
  ): Promise<void> {
    const mutations = this.infrastructure.mutationState;
    if (!mutations) throw new Error("BROWSER_MUTATION_STATE_UNAVAILABLE");
    mutations.assertRuntimeTaskProvenance();
    const currentJobRefHash = this.resolveBroker().currentOperatorTargetJobRefHash();
    if (currentJobRefHash === waiter.binding.jobRefHash) {
      if (waiter.targetMode === "authorized-continuation") {
        throw new Error("BROWSER_TARGET_INVALID");
      }
      return;
    }
    if (currentJobRefHash !== null) throw new Error("BROWSER_TARGET_INVALID");
    await this.acquireJobBoundTarget(
      Math.min(waiter.binding.commandTtlMs, waiter.remainingMs()), waiter.targetMode,
      waiter.binding.jobRefHash, parentConversationUrl,
    );
  }

  private async acquireJobBoundTarget(
    commandTtlMs: number,
    targetMode: BrowserTargetLeaseWait["targetMode"],
    jobRefHash: `sha256:${string}`,
    parentConversationUrl?: string,
  ): Promise<void> {
    await this.awaitTargetOperation(commandTtlMs, "acquire", jobRefHash, () =>
      this.websocket.requestPreauthorizedTargetAcquisition(
        targetMode, jobRefHash, parentConversationUrl,
      ));
  }

  public async releaseJobBoundTarget(
    commandTtlMs: number,
    jobRefHash: `sha256:${string}`,
    releaseAuthority: BrowserTargetReleaseAuthority,
  ): Promise<void> {
    await this.awaitTargetOperation(commandTtlMs, "release", jobRefHash, () => {
      this.websocket.requestPreauthorizedTargetRelease(jobRefHash, releaseAuthority);
    });
  }

  private async awaitTargetOperation(
    commandTtlMs: number,
    action: "acquire" | "release",
    jobRefHash: `sha256:${string}`,
    dispatch: () => number | void,
  ): Promise<void> {
    const current = this.issuer.current();
    if (current.kind === "ABSENT") throw new Error(current.reasonCode);
    if (!Number.isInteger(commandTtlMs) || commandTtlMs < 1 || commandTtlMs > 3_600_000) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
    if (this.infrastructure.pendingJobBoundTargetAcquisition) throw new Error("BROWSER_BACKPRESSURE");
    const deadlineMs = Math.min(commandTtlMs, BROWSER_COMMAND_DEFAULT_DEADLINE_MS);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const pending = this.infrastructure.pendingJobBoundTargetAcquisition;
        if (pending?.authorityEpoch !== current.authority.authorityEpoch
          || pending.action !== action || pending.jobRefHash !== jobRefHash) return;
        this.infrastructure.pendingJobBoundTargetAcquisition = null;
        reject(new Error("BROWSER_TARGET_ACQUISITION_TIMEOUT"));
      }, deadlineMs);
      this.infrastructure.pendingJobBoundTargetAcquisition = {
        authorityEpoch: current.authority.authorityEpoch,
        action,
        jobRefHash,
        resolve,
        reject,
        timeout,
      };
      try {
        const sequence = dispatch();
        if (sequence !== undefined) this.infrastructure.pendingJobBoundTargetAcquisition = {
          ...this.infrastructure.pendingJobBoundTargetAcquisition!, requestSequence: sequence,
        };
      }
      catch (error) {
        this.rejectPending(error instanceof Error ? error.message : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
      }
    });
  }

  public resolvePending(action: "acquire" | "release", jobRefHash: string): void {
    const pending = this.infrastructure.pendingJobBoundTargetAcquisition;
    if (!pending || pending.action !== action || pending.jobRefHash !== jobRefHash) {
      throw new Error("BROWSER_TARGET_INVALID");
    }
    this.infrastructure.pendingJobBoundTargetAcquisition = null;
    clearTimeout(pending.timeout);
    pending.resolve();
  }

  public rejectPending(reasonCode: string, refs: Readonly<Record<string, string>> = {}): void {
    const pending = this.infrastructure.pendingJobBoundTargetAcquisition;
    if (!pending) return;
    if (refs.jobRefHash && refs.jobRefHash !== pending.jobRefHash) return;
    if (refs.failedFrameSequence && pending.requestSequence !== undefined
      && Number(refs.failedFrameSequence) !== pending.requestSequence) return;
    this.infrastructure.pendingJobBoundTargetAcquisition = null;
    clearTimeout(pending.timeout);
    pending.reject(new Error(reasonCode));
  }
}
