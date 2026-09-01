import type { BrowserTargetLease } from "../exact-target/browser-target-lease.js";
import type {
  BrowserExactCallMutationFact,
  BrowserMutationReconciliationScope,
} from "../exact-target/browser-mutation-store.js";
import type { BrowserExecutionBinding } from "./browser-authority-broker.js";
import { BrowserAuthorityBroker } from "./browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "./browser-authority-issuer.js";
import type { createBrowserInfrastructureState } from "./browser-infrastructure-state.js";
import { BrowserAuthorityWebSocket } from "../transport/browser-authority-websocket.js";
import { browserExecutionFailure } from "../browser-failure.js";
import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS } from "../protocol/generated/browser-protocol.generated.js";

type LaneWaiter = Readonly<{
  binding: BrowserExecutionBinding;
  ownerId: string;
  signal: AbortSignal;
  remainingMs(): number;
  stopWaitingMonitor(): void;
  resolve(lease: BrowserTargetLease): void;
  reject(error: Error): void;
}>;

type LaneState = ReturnType<typeof createBrowserInfrastructureState>;

type LaneRecovery = Readonly<{
  state: "DISPATCHED" | "CONFIRMED" | "REJECTED";
  effectScope: "target_local" | "provider_effect";
  targetRef: string;
  documentRef: string;
}>;

const recoveryMutationOutcome = (
  recovery: LaneRecovery | null,
): "no" | "dispatched" | "confirmed" => recovery?.state === "DISPATCHED"
  ? "dispatched"
  : recovery?.state === "CONFIRMED"
    ? "confirmed"
    : "no";

const hash = (value: string): boolean => /^sha256:[a-f0-9]{64}$/u.test(value);

const exactCanonicalConversationUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.host === "chatgpt.com"
      && /^\/c\/[^/]+$/u.test(url.pathname)
      && value === `${url.origin}${url.pathname}`;
  } catch {
    return false;
  }
};

const replacementKey = (binding: Extract<BrowserExecutionBinding, {
  kind: "production-reconciliation";
}>): string => [
  binding.jobId,
  binding.confirmedProviderReadback.sourceAttemptId,
  binding.confirmedProviderReadback.sourceExactCallIdentityHash,
  binding.confirmedProviderReadback.evidenceHash,
].join(":");

export class BrowserLaneCoordinator {
  private readonly queue: LaneWaiter[] = [];
  private readonly confirmedReadbackReplacementTargets = new Map<string, string>();
  private active = false;

  public constructor(
    private readonly resolveBroker: () => BrowserAuthorityBroker,
    private readonly websocket: BrowserAuthorityWebSocket,
    private readonly issuer: BrowserAuthorityIssuer,
    private readonly infrastructure: LaneState,
  ) {}

  public acquire(
    binding: BrowserExecutionBinding,
    ownerId: string,
    wait: Readonly<{ signal: AbortSignal; remainingMs(): number }>,
  ): Promise<BrowserTargetLease> {
    if (this.queue.length >= 10) return Promise.reject(browserExecutionFailure(new Error("BROWSER_BACKPRESSURE")));
    return new Promise<BrowserTargetLease>((resolve, reject) => {
      let settled = false;
      let monitor: ReturnType<typeof setInterval> | null = null;
      const finish = <T>(action: (value: T) => void, value: T): void => {
        if (settled) return;
        settled = true;
        if (monitor) clearInterval(monitor);
        action(value);
      };
      const waiter: LaneWaiter = {
        binding, ownerId, signal: wait.signal, remainingMs: wait.remainingMs,
        stopWaitingMonitor: () => { if (monitor) clearInterval(monitor); monitor = null; },
        resolve: (lease) => finish(resolve, lease), reject: (error) => finish(reject, error),
      };
      this.queue.push(waiter);
      monitor = setInterval(() => this.expireWaiter(waiter), 100);
      void this.pump();
    });
  }

  private expireWaiter(waiter: LaneWaiter): void {
    if (!waiter.signal.aborted && waiter.remainingMs() >= 1) return;
    const index = this.queue.indexOf(waiter);
    if (index < 0) return;
    this.queue.splice(index, 1);
    waiter.reject(browserExecutionFailure(new Error(
      waiter.signal.aborted ? "BROWSER_WAIT_ABORTED" : "V6_DEADLINE_BUDGET_EXHAUSTED",
    )));
    void this.pump();
  }

  public readState(): "idle" | "busy" { return this.active ? "busy" : "idle"; }

  public waiterCount(): number { return this.queue.length; }

  public reset(reasonCode?: string): void {
    if (reasonCode) {
      this.rejectPending(reasonCode);
      for (const waiter of this.queue.splice(0)) waiter.reject(browserExecutionFailure(new Error(reasonCode)));
    }
    this.confirmedReadbackReplacementTargets.clear();
    this.active = false;
    void this.pump();
  }

  public hasUnresolvedMutation(): boolean {
    return this.infrastructure.mutationState?.reconciliationStates().some(
      (entry) => entry.current === "PREPARED" || entry.current === "DISPATCHED",
    ) ?? false;
  }


  public hasMutationForJob(jobId: string): boolean {
    return this.infrastructure.mutationState?.hasMutationForJob(jobId) ?? false;
  }

  public countProviderTurnDispatches(jobId: string, attemptId: string): number {
    return this.infrastructure.mutationState?.countProviderTurnDispatches(jobId, attemptId) ?? 0;
  }

  public reconciliationScope(
    input: Readonly<{ jobId: string; ownerPluginId: string }>,
  ): BrowserMutationReconciliationScope | null {
    return this.infrastructure.mutationState?.reconciliationScope(input) ?? null;
  }

  public readExactCallMutationFact(input: Readonly<{
    jobId: string;
    attemptId: string;
    ownerPluginId: string;
    pluginVersion: number;
    exactCallIdentityHash: `sha256:${string}`;
    actionOrdinal: number;
  }>): BrowserExactCallMutationFact | null {
    return this.infrastructure.mutationState?.readExactCallMutationFact(input) ?? null;
  }

  private nextWaiter(): LaneWaiter | null {
    let waiter = this.queue.shift();
    while (waiter && (waiter.signal.aborted || waiter.remainingMs() < 1)) {
      waiter.reject(browserExecutionFailure(new Error(
        waiter.signal.aborted ? "BROWSER_WAIT_ABORTED" : "V6_DEADLINE_BUDGET_EXHAUSTED",
      )));
      waiter = this.queue.shift();
    }
    return waiter ?? null;
  }

  private async pump(): Promise<void> {
    if (this.active) return;
    const waiter = this.nextWaiter();
    if (!waiter) return;
    waiter.stopWaitingMonitor();
    this.active = true;
    let recovery: LaneRecovery | null = null;
    let confirmedProviderTargetReplaced = false;
    try {
      recovery = this.recoveryFor(waiter.binding);
      const replacementBinding = waiter.binding.kind === "production-reconciliation"
        ? waiter.binding : null;
      const knownReplacementTarget = replacementBinding
        ? this.confirmedReadbackReplacementTargets.get(replacementKey(replacementBinding)) ?? null
        : null;
      if (this.resolveBroker().currentOperatorTargetStatus() === "absent") {
        const acquisitionTtlMs = Math.min(waiter.binding.commandTtlMs, waiter.remainingMs());
        try {
          await this.acquireJobBoundTarget(
            acquisitionTtlMs,
            knownReplacementTarget ?? recovery?.targetRef ?? null,
          );
        } catch (error) {
          if (!replacementBinding
            || recovery?.state !== "CONFIRMED"
            || recovery.effectScope !== "provider_effect"
            || !(error instanceof Error)
            || error.message !== "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT") throw error;
          await this.acquireJobBoundTarget(
            Math.min(waiter.binding.commandTtlMs, waiter.remainingMs()),
            null,
          );
          confirmedProviderTargetReplaced = true;
        }
      }
      if (waiter.signal.aborted || waiter.remainingMs() < 1) throw browserExecutionFailure(new Error(
        waiter.signal.aborted ? "BROWSER_WAIT_ABORTED" : "V6_DEADLINE_BUDGET_EXHAUSTED",
      ));
      const lease = await this.resolveBroker().acquireOperatorClaimedTargetLease(waiter.binding, waiter.ownerId);
      const targetMismatch = recovery && lease.target.targetRef !== recovery.targetRef;
      let restrictedReplacement = false;
      let currentReplacementKey: string | null = null;
      if (targetMismatch && replacementBinding) {
        currentReplacementKey = replacementKey(replacementBinding);
        const known = this.confirmedReadbackReplacementTargets.get(currentReplacementKey);
        if (!confirmedProviderTargetReplaced && known !== lease.target.targetRef) {
          throw new Error("BROWSER_DOCUMENT_INVALID");
        }
        if (this.confirmedReadbackReplacementTargets.size >= 100 && !known) {
          const oldest = this.confirmedReadbackReplacementTargets.keys().next().value as string | undefined;
          if (oldest) this.confirmedReadbackReplacementTargets.delete(oldest);
        }
        this.confirmedReadbackReplacementTargets.set(currentReplacementKey, lease.target.targetRef);
        restrictedReplacement = true;
      }
      if (recovery && ((targetMismatch && !restrictedReplacement)
        || (recovery.state === "DISPATCHED" && lease.document.documentRef !== recovery.documentRef))) {
        throw new Error("BROWSER_DOCUMENT_INVALID");
      }
      const governedLease = restrictedReplacement && replacementBinding
        ? this.confirmedReadbackLease(lease, replacementBinding)
        : lease;
      waiter.resolve(this.withLifecycle(governedLease, currentReplacementKey));
    } catch (error) {
      const failure = browserExecutionFailure(error, recoveryMutationOutcome(recovery));
      this.active = false;
      void this.pump();
      waiter.reject(failure);
    }
  }

  private recoveryFor(binding: BrowserExecutionBinding): LaneRecovery | null {
    const mutationState = this.infrastructure.mutationState;
    if (!mutationState) return null;
    if (binding.kind !== "production-reconciliation") {
      return mutationState.callRecoveryScope({
        jobId: binding.jobId,
        attemptId: binding.attemptId,
        ownerPluginId: binding.ownerPluginId,
        pluginVersion: binding.pluginVersion,
        productStepId: binding.productStepId,
      });
    }
    const authorization = binding.confirmedProviderReadback;
    const fact = mutationState.readExactCallMutationFact({
      jobId: binding.jobId,
      attemptId: authorization.sourceAttemptId,
      ownerPluginId: binding.ownerPluginId,
      pluginVersion: binding.pluginVersion,
      exactCallIdentityHash: authorization.sourceExactCallIdentityHash,
      actionOrdinal: authorization.sourceActionOrdinal,
    });
    if (!fact
      || authorization.schemaVersion !== "browser-confirmed-provider-readback.v1"
      || authorization.sourceProductStepId !== binding.productStepId
      || authorization.sourceChildCapabilityId !== "submit_exact_gpt_turn_once"
      || fact.effectScope !== "provider_effect"
      || fact.outcome !== "CONFIRMED"
      || fact.terminalAt !== authorization.sourceTerminalAt
      || fact.targetRef !== authorization.sourceTargetRef
      || fact.documentRef !== authorization.sourceDocumentRef
      || fact.productStepId !== authorization.sourceProductStepId
      || fact.callId !== authorization.sourceCallId
      || fact.childCapabilityId !== authorization.sourceChildCapabilityId
      || fact.actionOrdinal !== authorization.sourceActionOrdinal
      || !hash(authorization.sourceExactCallIdentityHash)
      || !hash(authorization.evidenceHash)
      || !hash(authorization.conversationIdentityHash)
      || !hash(authorization.promptHash)
      || !authorization.evidenceRef
      || !authorization.turnMarker
      || !Number.isFinite(Date.parse(authorization.sourceTerminalAt))
      || !exactCanonicalConversationUrl(authorization.canonicalConversationUrl)) {
      throw new Error("BROWSER_RECONCILIATION_SCOPE_INVALID");
    }
    return Object.freeze({
      state: fact.outcome,
      effectScope: fact.effectScope,
      targetRef: fact.targetRef,
      documentRef: fact.documentRef,
    });
  }

  private confirmedReadbackLease(
    lease: BrowserTargetLease,
    binding: Extract<BrowserExecutionBinding, { kind: "production-reconciliation" }>,
  ): BrowserTargetLease {
    const reject = async (): Promise<never> => {
      throw new Error("BROWSER_RECONCILIATION_SCOPE_INVALID");
    };
    const readKinds = new Set(["document", "inspect", "find", "readText", "readAttribute"]);
    return {
      ...lease,
      runAtomicStep: (identity, action) => identity.replayPolicy === "observation-only"
        ? lease.runAtomicStep(identity, action) : reject(),
      navigate: (input) => input.url === binding.confirmedProviderReadback.canonicalConversationUrl
        ? lease.navigate(input) : reject(),
      executeDomIntent: (intent) => readKinds.has(intent.kind)
        ? lease.executeDomIntent(intent) : reject(),
      observeCapability: (input) => lease.observeCapability(input),
      captureScreenshot: reject,
      attachFile: reject,
      downloadAuthenticatedMedia: (input) => lease.downloadAuthenticatedMedia(input),
      registerFileArtifact: reject,
      issueFileArtifactGrant: reject,
      wait: (input) => lease.wait(input),
      park: (input) => lease.park(input),
      close: (input) => lease.close(input),
      resolvePendingMutation: reject,
    };
  }

  private withLifecycle(lease: BrowserTargetLease, replacementKeyToClear: string | null): BrowserTargetLease {
    const finish = async (action: () => Promise<void>): Promise<void> => {
      try {
        await action();
      } catch (error) {
        this.resolveBroker().revokeOperatorTargetClaim(lease.target.targetRef);
        throw browserExecutionFailure(new Error("BROWSER_TARGET_LIFECYCLE_UNSETTLED", { cause: error }), "no");
      } finally {
        this.active = false;
        void this.pump();
      }
    };
    return {
      ...lease,
      park: (input) => finish(() => lease.park(input)),
      close: (input) => finish(async () => {
        try { await lease.close(input); }
        finally {
          if (replacementKeyToClear) this.confirmedReadbackReplacementTargets.delete(replacementKeyToClear);
        }
      }),
    };
  }

  private async acquireJobBoundTarget(commandTtlMs: number, targetRef: string | null = null): Promise<void> {
    const current = this.issuer.current();
    if (current.kind === "ABSENT") throw new Error(current.reasonCode);
    if (!Number.isInteger(commandTtlMs) || commandTtlMs < 1 || commandTtlMs > 3_600_000) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
    if (this.infrastructure.pendingJobBoundTargetAcquisition) throw new Error("BROWSER_BACKPRESSURE");
    const deadlineMs = Math.min(commandTtlMs, BROWSER_COMMAND_DEFAULT_DEADLINE_MS);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.infrastructure.pendingJobBoundTargetAcquisition?.authorityEpoch !== current.authority.authorityEpoch) return;
        this.infrastructure.pendingJobBoundTargetAcquisition = null;
        reject(new Error("BROWSER_TARGET_ACQUISITION_TIMEOUT"));
      }, deadlineMs);
      this.infrastructure.pendingJobBoundTargetAcquisition = {
        authorityEpoch: current.authority.authorityEpoch, expectedTargetRef: targetRef, resolve, reject, timeout,
      };
      try { this.websocket.requestPreauthorizedTargetAcquisition(targetRef ?? undefined); }
      catch (error) {
        this.rejectPending(error instanceof Error ? error.message : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
      }
    });
  }

  public resolvePending(targetRef: string): void {
    const pending = this.infrastructure.pendingJobBoundTargetAcquisition;
    if (!pending) return;
    if (pending.expectedTargetRef !== null && pending.expectedTargetRef !== targetRef) {
      this.rejectPending("BROWSER_RECONCILIATION_IDENTITY_MISMATCH");
      return;
    }
    this.infrastructure.pendingJobBoundTargetAcquisition = null;
    clearTimeout(pending.timeout);
    pending.resolve();
  }

  public rejectPending(reasonCode: string): void {
    const pending = this.infrastructure.pendingJobBoundTargetAcquisition;
    if (!pending) return;
    this.infrastructure.pendingJobBoundTargetAcquisition = null;
    clearTimeout(pending.timeout);
    pending.reject(new Error(reasonCode));
  }
}
