import { createHash } from "node:crypto";
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
import { emitBrowserMutationEvent } from "../exact-target/browser-command-runtime-logging.js";
import type { RuntimeLogger } from "../../runtime-logs/index.js";
import {
  BrowserTargetAcquirer,
  type BrowserTargetAcquisition,
} from "./browser-target-acquirer.js";

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
  commandId: string;
  ownerPluginId: string;
  pluginVersion: number;
  jobId: string;
  attemptId: string;
  productStepId: string;
  childCapabilityId: string;
  state: "DISPATCHED" | "CONFIRMED" | "REJECTED";
  effectScope: "target_local" | "provider_effect";
  callId: string;
  targetRef: string;
  documentRef: string;
}>;

const recoveryMutationOutcome = (
  recovery: LaneRecovery | null,
  currentCallId: string,
): "no" | "dispatched" | "confirmed" => {
  if (!recovery || recovery.callId !== currentCallId) return "no";
  if (recovery.state === "DISPATCHED") return "dispatched";
  return recovery.state === "CONFIRMED" ? "confirmed" : "no";
};

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

type ReconciliationBinding = Extract<BrowserExecutionBinding, { kind: "production-reconciliation" }>;
type FailureReadbackBinding = Extract<BrowserExecutionBinding, { kind: "production-confirmed-failure-readback" }>;
type ConfirmedReadbackBinding = ReconciliationBinding | FailureReadbackBinding;
const CONFIRMED_READBACK_TARGET_LOCAL_CHILDREN = new Set([
  "focus_exact_gpt_conversation",
  "wait_for_stable_gpt_text",
  "wait_for_stable_gpt_image",
]);

const readbackSource = (binding: ConfirmedReadbackBinding) => binding.kind === "production-reconciliation"
  ? binding.confirmedProviderReadback : binding.confirmedProviderFailureReadback;

const confirmedSourceMatches = (
  binding: ConfirmedReadbackBinding,
  fact: BrowserExactCallMutationFact | null,
): fact is BrowserExactCallMutationFact => {
  const source = readbackSource(binding);
  return Boolean(fact) && [
  source.sourceProductStepId === binding.productStepId,
  source.sourceChildCapabilityId === "submit_exact_gpt_turn_once",
  fact?.effectScope === "provider_effect", fact?.outcome === "CONFIRMED",
  fact?.terminalAt === source.sourceTerminalAt,
  fact?.targetRef === source.sourceTargetRef,
  fact?.documentRef === source.sourceDocumentRef,
  fact?.productStepId === source.sourceProductStepId,
  fact?.callId === source.sourceCallId,
  fact?.childCapabilityId === source.sourceChildCapabilityId,
  fact?.actionOrdinal === source.sourceActionOrdinal,
  hash(source.sourceExactCallIdentityHash), hash(source.evidenceHash), hash(source.promptHash),
  Boolean(source.evidenceRef), Boolean(source.turnMarker),
  Number.isFinite(Date.parse(source.sourceTerminalAt)),
  binding.kind === "production-reconciliation"
    ? binding.confirmedProviderReadback.schemaVersion === "browser-confirmed-provider-readback.v1"
      && hash(binding.confirmedProviderReadback.conversationIdentityHash)
      && exactCanonicalConversationUrl(binding.confirmedProviderReadback.canonicalConversationUrl)
    : binding.confirmedProviderFailureReadback.schemaVersion
      === "browser-confirmed-provider-failure-readback.v1",
  ].every(Boolean);
};

export class BrowserLaneCoordinator {
  private readonly queue: LaneWaiter[] = [];
  private readonly targetAcquirer: BrowserTargetAcquirer;
  private quarantine: LaneRecovery | null = null;
  private active = false;

  public constructor(
    private readonly resolveBroker: () => BrowserAuthorityBroker,
    websocket: BrowserAuthorityWebSocket,
    issuer: BrowserAuthorityIssuer,
    private readonly infrastructure: LaneState,
    private readonly runtimeLogger: RuntimeLogger,
  ) {
    this.targetAcquirer = new BrowserTargetAcquirer(
      resolveBroker, websocket, issuer, infrastructure,
    );
  }

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

  public readState(): "idle" | "busy" | "blocked" {
    return this.active ? "busy" : this.quarantine ? "blocked" : "idle";
  }

  public waiterCount(): number { return this.queue.length; }

  public reset(reasonCode?: string): void {
    if (reasonCode) {
      this.rejectPending(reasonCode);
      for (const waiter of this.queue.splice(0)) waiter.reject(browserExecutionFailure(new Error(reasonCode)));
    }
    this.targetAcquirer.reset();
    this.quarantine = null;
    if (!reasonCode) this.refreshQuarantine();
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
  public readCurrentTargetLocalReconciliationCandidate(): Readonly<{ jobId: string }> | null {
    const recovery = this.quarantine;
    return recovery?.state === "DISPATCHED" && recovery.effectScope === "target_local"
      ? Object.freeze({ jobId: recovery.jobId }) : null;
  }

  public async reconcilePermanentlyRevokedTargetLocal(input: Readonly<{ jobId: string }>): Promise<"retained" | "settled"> {
    const recovery = this.quarantine;
    if (!recovery || recovery.state !== "DISPATCHED" || recovery.effectScope !== "target_local"
      || recovery.jobId !== input.jobId) return "settled";
    if (this.active || this.resolveBroker().currentOperatorTargetStatus() !== "absent") return "retained";
    this.active = true;
    try {
      await this.targetAcquirer.probeExactExistingTarget(recovery.targetRef);
      return this.quarantine?.commandId === recovery.commandId ? "retained" : "settled";
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT") throw error;
      this.settleLostTargetLocalDocument(recovery);
      return "settled";
    } finally { this.active = false; void this.pump(); }
  }

  public observeCurrentTargetClaim(input: Readonly<{ targetRef: string; documentRef: string }>): void {
    let recovery = this.quarantine;
    while (recovery?.state === "DISPATCHED" && recovery.effectScope === "target_local"
      && (recovery.targetRef !== input.targetRef || recovery.documentRef !== input.documentRef)) {
      this.settleLostTargetLocalDocument(recovery, input);
      recovery = this.quarantine;
    }
    void this.pump();
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
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      const waiter = this.queue[index]!;
      if (!waiter.signal.aborted && waiter.remainingMs() >= 1) continue;
      this.queue.splice(index, 1);
      waiter.reject(browserExecutionFailure(new Error(
        waiter.signal.aborted ? "BROWSER_WAIT_ABORTED" : "V6_DEADLINE_BUDGET_EXHAUSTED",
      )));
    }
    const index = this.quarantine
      ? this.queue.findIndex((waiter) => this.bindingMatchesRecovery(waiter.binding, this.quarantine!))
      : 0;
    return index < 0 ? null : this.queue.splice(index, 1)[0] ?? null;
  }

  private async pump(): Promise<void> {
    if (this.active) return;
    const waiter = this.nextWaiter();
    if (!waiter) return;
    waiter.stopWaitingMonitor();
    this.active = true;
    let recovery: LaneRecovery | null = null;
    try {
      recovery = this.quarantine && this.bindingMatchesRecovery(waiter.binding, this.quarantine)
        ? this.quarantine : this.recoveryFor(waiter.binding);
      const acquisition = await this.targetAcquirer.ensureAvailableTarget(
        waiter, recovery, () => this.rejectLostTargetLocalDocument(recovery!),
      );
      if (waiter.signal.aborted || waiter.remainingMs() < 1) throw browserExecutionFailure(new Error(
        waiter.signal.aborted ? "BROWSER_WAIT_ABORTED" : "V6_DEADLINE_BUDGET_EXHAUSTED",
      ));
      const lease = await this.resolveBroker().acquireOperatorClaimedTargetLease(waiter.binding, waiter.ownerId);
      let admitted: ReturnType<BrowserLaneCoordinator["admitRecoveredLease"]>;
      try {
        admitted = this.admitRecoveredLease(waiter.binding, lease, recovery, acquisition);
      } catch (error) {
        try {
          await lease.park({
            reason: "browser-recovery-admission-rejected",
            mode: recovery?.state === "DISPATCHED" ? "recovery" : "normal-provider-wait",
          });
        } catch (parkError) {
          this.resolveBroker().revokeOperatorTargetClaim(lease.target.targetRef);
          throw new AggregateError([error, parkError], "BROWSER_TARGET_LIFECYCLE_UNSETTLED", { cause: error });
        }
        throw error;
      }
      waiter.resolve(this.withLifecycle(admitted.lease, admitted.replacementKey));
    } catch (error) {
      const failure = browserExecutionFailure(
        error,
        recoveryMutationOutcome(recovery, waiter.binding.callId),
      );
      this.active = false;
      void this.pump();
      waiter.reject(failure);
    }
  }

  private admitRecoveredLease(
    binding: BrowserExecutionBinding,
    lease: BrowserTargetLease,
    recovery: LaneRecovery | null,
    acquisition: BrowserTargetAcquisition,
  ): Readonly<{ lease: BrowserTargetLease; replacementKey: string | null }> {
    const targetMismatch = Boolean(recovery) && lease.target.targetRef !== recovery?.targetRef;
    const documentMismatch = Boolean(recovery) && lease.document.documentRef !== recovery?.documentRef;
    if (binding.kind === "production-confirmed-failure-readback" && (targetMismatch || documentMismatch)) {
      throw new Error("BROWSER_DOCUMENT_INVALID");
    }
    if (recovery?.state === "DISPATCHED" && recovery.effectScope === "target_local"
      && (targetMismatch || documentMismatch)) {
      this.rejectLostTargetLocalDocument(recovery);
    }
    const replacementKeyToClear = targetMismatch && acquisition.replacementBinding
      ? this.targetAcquirer.recordReplacementTarget(
        acquisition.replacementBinding, lease.target.targetRef, acquisition.confirmedProviderTargetReplaced,
      ) : null;
    if (recovery && ((targetMismatch && !replacementKeyToClear)
      || (recovery.state === "DISPATCHED" && lease.document.documentRef !== recovery.documentRef))) {
      throw new Error("BROWSER_DOCUMENT_INVALID");
    }
    const admittedLease = binding.kind === "production-confirmed-failure-readback"
      ? this.confirmedFailureReadbackLease(lease)
      : binding.kind === "production-reconciliation"
        ? this.confirmedReadbackLease(lease, binding) : lease;
    return {
      lease: admittedLease,
      replacementKey: replacementKeyToClear,
    };
  }

  private recoveryFor(binding: BrowserExecutionBinding): LaneRecovery | null {
    const mutationState = this.infrastructure.mutationState;
    if (!mutationState) return null;
    if (binding.kind !== "production-reconciliation"
      && binding.kind !== "production-confirmed-failure-readback") {
      const scope = mutationState.callRecoveryScope({
        jobId: binding.jobId,
        attemptId: binding.attemptId,
        ownerPluginId: binding.ownerPluginId,
        pluginVersion: binding.pluginVersion,
        productStepId: binding.productStepId,
      });
      return scope ? Object.freeze({
        ...scope,
        pluginVersion: binding.pluginVersion,
        attemptId: binding.attemptId,
        childCapabilityId: mutationState.readDispatched(scope.commandId)?.childCapabilityId ?? "recovered-call",
      }) : null;
    }
    const authorization = readbackSource(binding);
    const fact = mutationState.readExactCallMutationFact({
      jobId: binding.jobId,
      attemptId: authorization.sourceAttemptId,
      ownerPluginId: binding.ownerPluginId,
      pluginVersion: binding.pluginVersion,
      exactCallIdentityHash: authorization.sourceExactCallIdentityHash,
      actionOrdinal: authorization.sourceActionOrdinal,
    });
    if (!confirmedSourceMatches(binding, fact)) {
      throw new Error("BROWSER_RECONCILIATION_SCOPE_INVALID");
    }
    return Object.freeze({
      commandId: fact.authorityRef.slice("browser-mutation:".length),
      ownerPluginId: binding.ownerPluginId,
      pluginVersion: binding.pluginVersion,
      jobId: binding.jobId,
      attemptId: authorization.sourceAttemptId,
      productStepId: fact.productStepId,
      childCapabilityId: fact.childCapabilityId,
      state: fact.outcome,
      effectScope: fact.effectScope,
      callId: fact.callId,
      targetRef: fact.targetRef,
      documentRef: fact.documentRef,
    });
  }

  private confirmedFailureReadbackLease(lease: BrowserTargetLease): BrowserTargetLease {
    const reject = async (): Promise<never> => {
      throw new Error("BROWSER_RECONCILIATION_SCOPE_INVALID");
    };
    const readKinds = new Set([
      "document", "observe", "readExactAssistantTurn", "inspect", "find", "readText", "readAttribute",
    ]);
    return {
      ...lease,
      runAtomicStep: (identity, action) => identity.replayPolicy === "observation-only"
        ? lease.runAtomicStep(identity, action) : reject(),
      navigate: reject,
      executeDomIntent: (intent) => readKinds.has(intent.kind)
        ? lease.executeDomIntent(intent) : reject(),
      observeCapability: (input) => lease.observeCapability(input),
      captureScreenshot: reject,
      attachFile: reject,
      downloadAuthenticatedMedia: reject,
      wait: (input) => lease.wait(input),
      park: (input) => lease.park(input),
      close: (input) => lease.close(input),
      resolvePendingMutation: reject,
    };
  }

  private confirmedReadbackLease(
    lease: BrowserTargetLease,
    binding: Extract<BrowserExecutionBinding, { kind: "production-reconciliation" }>,
  ): BrowserTargetLease {
    const reject = async (): Promise<never> => {
      throw new Error("BROWSER_RECONCILIATION_SCOPE_INVALID");
    };
    const readKinds = new Set([
      "document", "observe", "readExactAssistantTurn", "inspect", "find", "readText", "readAttribute",
    ]);
    return {
      ...lease,
      runAtomicStep: (identity, action) => identity.replayPolicy === "observation-only"
        || (identity.replayPolicy === "target-local-per-generation"
          && CONFIRMED_READBACK_TARGET_LOCAL_CHILDREN.has(identity.childCapabilityId))
        ? lease.runAtomicStep(identity, action) : reject(),
      navigate: (input) => input.url === binding.confirmedProviderReadback.canonicalConversationUrl
        ? lease.navigate(input) : reject(),
      executeDomIntent: (intent) => readKinds.has(intent.kind)
        ? lease.executeDomIntent(intent) : reject(),
      observeCapability: (input) => lease.observeCapability(input),
      captureScreenshot: reject,
      attachFile: reject,
      downloadAuthenticatedMedia: (input) => lease.downloadAuthenticatedMedia(input),
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
        this.refreshQuarantine();
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
          if (replacementKeyToClear) this.targetAcquirer.clearReplacementTarget(replacementKeyToClear);
        }
      }),
    };
  }

  private bindingMatchesRecovery(binding: BrowserExecutionBinding, recovery: LaneRecovery): boolean {
    return binding.jobId === recovery.jobId
      && binding.attemptId === recovery.attemptId
      && binding.ownerPluginId === recovery.ownerPluginId
      && binding.pluginVersion === recovery.pluginVersion
      && binding.productStepId === recovery.productStepId;
  }

  private refreshQuarantine(): void {
    const state = this.infrastructure.mutationState;
    const entry = state?.reconciliationStates().find((candidate) => candidate.current === "DISPATCHED");
    this.quarantine = entry ? Object.freeze({
      commandId: entry.mutation.commandId,
      ownerPluginId: entry.mutation.ownerPluginId,
      pluginVersion: entry.mutation.pluginVersion,
      jobId: entry.mutation.jobId,
      attemptId: entry.mutation.attemptId,
      productStepId: entry.mutation.productStepId,
      childCapabilityId: entry.mutation.childCapabilityId,
      state: "DISPATCHED",
      effectScope: entry.mutation.effectScope,
      callId: entry.mutation.callId,
      targetRef: entry.mutation.targetRef,
      documentRef: entry.mutation.documentRef,
    }) : null;
  }

  private rejectLostTargetLocalDocument(recovery: LaneRecovery): never {
    this.settleLostTargetLocalDocument(recovery);
    throw browserExecutionFailure(
      new Error("BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT"),
      "dispatched",
      {
        effectScope: "target_local",
        childCapabilityId: recovery.childCapabilityId,
        browserOutcome: "REJECTED",
      },
    );
  }

  private settleLostTargetLocalDocument(
    recovery: LaneRecovery,
    observed?: Readonly<{ targetRef: string; documentRef: string }>,
  ): void {
    const mutationState = this.infrastructure.mutationState;
    if (!mutationState || recovery.state !== "DISPATCHED" || recovery.effectScope !== "target_local") {
      throw new Error("BROWSER_MUTATION_STATE_UNAVAILABLE");
    }
    const mutation = mutationState.readDispatched(recovery.commandId);
    if (!mutation || mutation.targetRef !== recovery.targetRef
      || mutation.documentRef !== recovery.documentRef || mutation.effectScope !== "target_local") {
      throw new Error("BROWSER_RECONCILIATION_IDENTITY_MISMATCH");
    }
    const proofHash = `sha256:${createHash("sha256").update(JSON.stringify({
      commandId: recovery.commandId,
      targetRef: recovery.targetRef,
      documentRef: recovery.documentRef,
      observedTargetRef: observed?.targetRef ?? null,
      observedDocumentRef: observed?.documentRef ?? null,
      conclusion: "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT",
    })).digest("hex")}` as const;
    mutationState.markTargetLocalDocumentAbsent({
      commandId: recovery.commandId,
      targetRef: recovery.targetRef,
      documentRef: recovery.documentRef,
      proofHash,
    });
    try {
      emitBrowserMutationEvent({
        runtimeLogger: this.runtimeLogger,
        mutation,
        outcome: "REJECTED",
        authorityHash: mutationState.authorityHash(recovery.commandId),
      });
    } finally { this.refreshQuarantine(); }
  }

  public resolvePending(targetRef: string): void {
    this.targetAcquirer.resolvePending(targetRef);
  }

  public rejectPending(reasonCode: string): void {
    this.targetAcquirer.rejectPending(reasonCode);
  }
}
