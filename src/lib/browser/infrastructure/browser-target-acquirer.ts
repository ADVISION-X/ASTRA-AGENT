import { BrowserAuthorityBroker, type BrowserExecutionBinding } from "./browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "./browser-authority-issuer.js";
import type { createBrowserInfrastructureState } from "./browser-infrastructure-state.js";
import { BrowserAuthorityWebSocket } from "../transport/browser-authority-websocket.js";
import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS, BROWSER_TARGET_ACQUISITION_MAX_WAIT_MS } from "../protocol/generated/browser-protocol.generated.js";
import type { BrowserTargetLeaseWait, BrowserTargetReleaseAuthority } from "../exact-target/browser-target-lease.js";

type TargetWaiter = Readonly<{
  binding: BrowserExecutionBinding; targetMode: BrowserTargetLeaseWait["targetMode"];
  providerEffectIdentityHash?: `sha256:${string}`; signal: AbortSignal; remainingMs(): number;
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
    if (waiter.signal.aborted) throw new Error("BROWSER_WAIT_ABORTED");
    const budget = Math.min(waiter.remainingMs(), BROWSER_TARGET_ACQUISITION_MAX_WAIT_MS);
    if (budget < 1) throw new Error("V6_DEADLINE_BUDGET_EXHAUSTED");
    const store = this.infrastructure.mutationState;
    if (!store) throw new Error("BROWSER_MUTATION_STATE_UNAVAILABLE");
    store.assertRuntimeTaskProvenance();
    const destination = waiter.targetMode === "confirmed-readback" ? this.readConversationUrl(waiter) : parentConversationUrl;
    const claimed = this.resolveBroker().currentOperatorTargetJobRefHash();
    if (claimed !== null) {
      if (claimed !== waiter.binding.jobRefHash || waiter.targetMode === "authorized-continuation") throw new Error("BROWSER_TARGET_INVALID");
    }
    await this.awaitTargetOperation(budget, "acquire", waiter.binding.jobRefHash,
      deadline => this.websocket.requestPreauthorizedTargetAcquisition(waiter.targetMode,
        waiter.binding.jobRefHash, destination, deadline), waiter.signal);
  }

  private readConversationUrl(waiter: TargetWaiter): string {
    const store = this.infrastructure.mutationState!;
    const history = store.jobHistoryEvidence(waiter.binding.jobId);
    if (!history.walHistoryVerified) throw new Error("BROWSER_SOURCE_EFFECT_READBACK_INVALID");
    const hash = waiter.providerEffectIdentityHash;
    const candidates = history.replayEffects.filter(effect => hash === undefined
      ? effect.state === "CONFIRMED" && effect.anchorState === "trusted"
      : effect.effectIdentityHash === hash);
    if (!candidates.length || hash !== undefined && candidates.length !== 1) {
      throw new Error("BROWSER_SOURCE_EFFECT_IDENTITY_MISMATCH");
    }
    const urls = new Set(candidates.map(effect => {
      const locator = store.readSourceConfirmedProviderEffect({ jobId: waiter.binding.jobId,
        sourceAttemptId: effect.attemptId, sourceResultRevision: effect.resultRevision,
        productStepId: effect.productStepId, callId: effect.callId, childCapabilityId: effect.childCapabilityId,
        effectIdentityHash: effect.effectIdentityHash, walAuthorityHash: effect.walAuthorityHash }).conversationLocator;
      if (!locator) throw new Error("BROWSER_SOURCE_EFFECT_READBACK_INVALID");
      return locator.canonicalConversationUrl;
    }));
    if (urls.size !== 1) throw new Error("BROWSER_SOURCE_EFFECT_READBACK_INVALID");
    return [...urls][0]!;
  }

  private async awaitTargetOperation(budgetMs: number, action: "acquire" | "release", jobRefHash: `sha256:${string}`,
    dispatch: (deadlineAt: number) => number, signal?: AbortSignal): Promise<void> {
    const authority = this.issuer.current();
    if (authority.kind === "ABSENT") throw new Error(authority.reasonCode);
    if (!Number.isInteger(budgetMs) || budgetMs < 1 || budgetMs > 3_600_000
      || action === "acquire" && !signal) throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    if (signal?.aborted) throw new Error("BROWSER_WAIT_ABORTED");
    if (this.infrastructure.pendingJobBoundTargetAcquisition) throw new Error("BROWSER_BACKPRESSURE");
    const maximum = action === "acquire" ? BROWSER_TARGET_ACQUISITION_MAX_WAIT_MS : BROWSER_COMMAND_DEFAULT_DEADLINE_MS;
    const deadlineAt = Date.now() + Math.min(budgetMs, maximum);
    await new Promise<void>((resolve, reject) => {
      let cancelDispatched = false;
      const cancel = (): void => {
        const current = this.issuer.current();
        if (cancelDispatched || this.infrastructure.pendingJobBoundTargetAcquisition !== pending
          || current.kind === "ABSENT" || current.authority.authorityEpoch !== pending.authorityEpoch
          || pending.requestSequence === undefined || Date.now() >= deadlineAt) return;
        cancelDispatched = true;
        try {
          this.websocket.requestPreauthorizedTargetAcquisitionCancellation(jobRefHash, pending.requestSequence,
            Math.min(deadlineAt, Date.now() + BROWSER_COMMAND_DEFAULT_DEADLINE_MS));
        } catch (error) {
          this.rejectPending(error instanceof Error ? error.message : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
        }
      };
      const stopAbortMonitor = (): void => signal?.removeEventListener("abort", cancel);
      const timeout = setTimeout(() => {
        if (this.infrastructure.pendingJobBoundTargetAcquisition === pending) this.rejectPending("BROWSER_TARGET_ACQUISITION_TIMEOUT");
      }, Math.max(1, deadlineAt - Date.now()));
      const base = { authorityEpoch: authority.authority.authorityEpoch, jobRefHash, deadlineAt, resolve, reject, timeout };
      const pending: NonNullable<LaneState["pendingJobBoundTargetAcquisition"]> = action === "acquire"
        ? { ...base, action, signal: signal!, stopAbortMonitor } : { ...base, action };
      this.infrastructure.pendingJobBoundTargetAcquisition = pending;
      try {
        const sequence = dispatch(deadlineAt);
        Object.assign(pending, { requestSequence: sequence });
        if (pending.action === "acquire" && this.infrastructure.pendingJobBoundTargetAcquisition === pending) {
          pending.signal.addEventListener("abort", cancel, { once: true });
          if (pending.signal.aborted) cancel();
        }
      } catch (error) {
        this.rejectPending(error instanceof Error ? error.message : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
      }
    });
  }

  public resolvePending(action: "acquire" | "release", jobRefHash: string): void {
    const pending = this.infrastructure.pendingJobBoundTargetAcquisition;
    if (!pending || pending.action !== action || pending.jobRefHash !== jobRefHash) throw new Error("BROWSER_TARGET_INVALID");
    clearTimeout(pending.timeout);
    if (pending.action === "acquire") pending.stopAbortMonitor();
    this.infrastructure.pendingJobBoundTargetAcquisition = null;
    pending.resolve();
  }

  public rejectPending(reasonCode: string, refs: Readonly<Record<string, string>> = {}): void {
    const pending = this.infrastructure.pendingJobBoundTargetAcquisition;
    if (!pending || refs.jobRefHash && refs.jobRefHash !== pending.jobRefHash
      || refs.failedFrameSequence && pending.requestSequence !== undefined
        && Number(refs.failedFrameSequence) !== pending.requestSequence) return;
    clearTimeout(pending.timeout);
    if (pending.action === "acquire") pending.stopAbortMonitor();
    this.infrastructure.pendingJobBoundTargetAcquisition = null;
    pending.reject(new Error(reasonCode));
  }

  public async releaseJobBoundTarget(
    commandTtlMs: number, jobRefHash: `sha256:${string}`, releaseAuthority: BrowserTargetReleaseAuthority,
  ): Promise<void> {
    await this.awaitTargetOperation(commandTtlMs, "release", jobRefHash, deadlineAt =>
      this.websocket.requestPreauthorizedTargetRelease(jobRefHash, releaseAuthority, deadlineAt));
  }
}
