import { BrowserAuthorityBroker, type BrowserExecutionBinding } from "./browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "./browser-authority-issuer.js";
import type { createBrowserInfrastructureState } from "./browser-infrastructure-state.js";
import { BrowserAuthorityWebSocket } from "../transport/browser-authority-websocket.js";
import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS } from "../protocol/generated/browser-protocol.generated.js";
import type { BrowserTargetLeaseWait, BrowserTargetReleaseAuthority } from "../exact-target/browser-target-lease.js";

type TargetWaiter = Readonly<{
  binding: BrowserExecutionBinding; targetMode: BrowserTargetLeaseWait["targetMode"]; remainingMs(): number;
}>;
type LaneState = ReturnType<typeof createBrowserInfrastructureState>;

export class BrowserTargetAcquirer {
  public constructor(
    private readonly resolveBroker: () => BrowserAuthorityBroker,
    private readonly websocket: BrowserAuthorityWebSocket,
    private readonly issuer: BrowserAuthorityIssuer,
    private readonly infrastructure: LaneState,
  ) {}

  public async ensureAvailableTarget(waiter: TargetWaiter, parentConversationUrl?: string): Promise<void> {
    const store = this.infrastructure.mutationState;
    if (!store) throw new Error("BROWSER_MUTATION_STATE_UNAVAILABLE");
    store.assertRuntimeTaskProvenance();
    const jobRefHash = this.resolveBroker().currentOperatorTargetJobRefHash();
    if (jobRefHash === waiter.binding.jobRefHash) {
      if (waiter.targetMode === "authorized-continuation") throw new Error("BROWSER_TARGET_INVALID");
      return;
    }
    if (jobRefHash !== null) throw new Error("BROWSER_TARGET_INVALID");
    await this.awaitTargetOperation(Math.min(waiter.binding.commandTtlMs, waiter.remainingMs()),
      "acquire", waiter.binding.jobRefHash, deadlineAt => this.websocket.requestPreauthorizedTargetAcquisition(
        waiter.targetMode, waiter.binding.jobRefHash, parentConversationUrl, deadlineAt));
  }

  public async releaseJobBoundTarget(
    commandTtlMs: number, jobRefHash: `sha256:${string}`, releaseAuthority: BrowserTargetReleaseAuthority,
  ): Promise<void> {
    await this.awaitTargetOperation(commandTtlMs, "release", jobRefHash, deadlineAt =>
      this.websocket.requestPreauthorizedTargetRelease(jobRefHash, releaseAuthority, deadlineAt));
  }

  private async awaitTargetOperation(
    budgetMs: number, action: "acquire" | "release", jobRefHash: `sha256:${string}`,
    dispatch: (deadlineAt: number) => number,
  ): Promise<void> {
    const current = this.issuer.current();
    if (current.kind === "ABSENT") throw new Error(current.reasonCode);
    if (!Number.isInteger(budgetMs) || budgetMs < 1 || budgetMs > 3_600_000) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
    if (this.infrastructure.pendingJobBoundTargetAcquisition) throw new Error("BROWSER_BACKPRESSURE");
    const deadlineAt = Date.now() + Math.min(budgetMs, BROWSER_COMMAND_DEFAULT_DEADLINE_MS);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const pending = this.infrastructure.pendingJobBoundTargetAcquisition;
        if (pending?.authorityEpoch !== current.authority.authorityEpoch || pending.action !== action
          || pending.jobRefHash !== jobRefHash) return;
        this.infrastructure.pendingJobBoundTargetAcquisition = null;
        reject(new Error("BROWSER_TARGET_ACQUISITION_TIMEOUT"));
      }, Math.max(1, deadlineAt - Date.now()));
      this.infrastructure.pendingJobBoundTargetAcquisition = {
        authorityEpoch: current.authority.authorityEpoch, action, jobRefHash, resolve, reject, timeout,
      };
      try {
        const sequence = dispatch(deadlineAt);
        const pending = this.infrastructure.pendingJobBoundTargetAcquisition;
        if (pending) this.infrastructure.pendingJobBoundTargetAcquisition = {
          ...pending, requestSequence: sequence,
        };
      } catch (error) {
        this.rejectPending(error instanceof Error ? error.message : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
      }
    });
  }

  public resolvePending(action: "acquire" | "release", jobRefHash: string): void {
    const pending = this.infrastructure.pendingJobBoundTargetAcquisition;
    if (!pending || pending.action !== action || pending.jobRefHash !== jobRefHash) throw new Error("BROWSER_TARGET_INVALID");
    this.infrastructure.pendingJobBoundTargetAcquisition = null;
    clearTimeout(pending.timeout);
    pending.resolve();
  }

  public rejectPending(reasonCode: string, refs: Readonly<Record<string, string>> = {}): void {
    const pending = this.infrastructure.pendingJobBoundTargetAcquisition;
    if (!pending || (refs.jobRefHash && refs.jobRefHash !== pending.jobRefHash)
      || (refs.failedFrameSequence && pending.requestSequence !== undefined
        && Number(refs.failedFrameSequence) !== pending.requestSequence)) return;
    this.infrastructure.pendingJobBoundTargetAcquisition = null;
    clearTimeout(pending.timeout);
    pending.reject(new Error(reasonCode));
  }
}
