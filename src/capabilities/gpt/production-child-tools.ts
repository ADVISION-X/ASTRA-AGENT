import { GPT_CHILD_CAPABILITY_CONTRACTS, gptCanonicalHash, gptExactCallIdentityHash, type GptAbilityGroup,
  type GptAnyChildCapabilityIntent, type GptChildCapabilityId, type GptChildCapabilityIntent, type GptChildCapabilityResult,
  type GptExecutionContext, type GptHash } from "./contract.js";
import { failedGptChildExecutionResult } from "./ability-group.js";
import { requireRuntimeLogWrite, type RuntimeLogger, type RuntimeSpanHandle } from "../../lib/runtime-logs/index.js";
import { executionFailure, failureCode } from "../../lib/execution-failure.js";
import type { BrowserAtomicStepIdentity } from "../../lib/browser/browser-authority-api.js";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import { ProductionGptBrowserLifecycle } from "./production-browser-lifecycle.js";
import { ProductionGptExecutionSession } from "./production-execution-session.js";
import { ProductionGptSourceReuse } from "./production-execution-source-reuse.js";
import { gptExecutionFailure, typedGptExecutionFailure } from "./execution-fault.js";
import { confirmedSubmitIdentity, persistGptChildOutcome, productChildResult, recordSettledProviderResult, submitEffect } from "./production-child-result.js";
import { acquireProductionBrowserCall, recoverPersistedTextCheckpoint, runProductionAtomicPhase } from "./production-call-preparation.js";
import { readPersistedGptImageEvidence, readPersistedGptTextResponse } from "./evidence-artifacts.js";
import type { GptEvidenceStorePort, GptProductionBrowserAuthority, ProviderRateLimitControlPort,
  GptProductionExecutionInput as ExecutionInput } from "./production-ports.js";
import { closeKnownProviderRateLimit, confirmedRateLimitAckHash, notClearedRateLimit } from "./production-rate-limit-closure.js";
import { throwGptChildFailure, handleGptChildExecutionError, terminalizeGptChildError,
  terminalizeGptChildResult, type ProductGptExecution } from "./production-child-support.js";
export type { ProductGptExecution } from "./production-child-support.js";

type ReadbackRecorder = NonNullable<GptExecutionContext["recordConfirmedProviderEffectReadback"]>;
type ConfirmedSubmitCall = ProductGptCallInput<"submit_exact_gpt_turn_once"> & Readonly<{ sessionKey: string }>;
type ExecuteOneOptions = Readonly<{ priorEffectKnown?: boolean; rateLimitAckDispatchNotAfter?: number;
  browserAtomicIdentity?: BrowserAtomicStepIdentity; recordConfirmedProviderEffectReadback?: ReadbackRecorder }>;
export class ProductionGptChildTools {
  public constructor(private readonly dataDir: string, private readonly sourceHash: GptHash,
    private readonly gpt: GptAbilityGroup, private readonly evidenceStore: GptEvidenceStorePort,
    private readonly browserAuthority: GptProductionBrowserAuthority, private readonly runtimeLogger: RuntimeLogger,
    private readonly providerRateLimitControl: ProviderRateLimitControlPort) {}
  public async verifySourceCheckpointArtifact(input: Readonly<{ jobId: string; sourceAttemptId: string;
    checkpointExactCallIdentityHash: GptHash; artifactRef: string; artifactContentHash: GptHash }>): Promise<void> {
    const source = { evidenceStore: this.evidenceStore, jobId: input.jobId, attemptId: input.sourceAttemptId,
      exactCallIdentityHash: input.checkpointExactCallIdentityHash };
    const artifact = await readPersistedGptTextResponse(source) ?? await readPersistedGptImageEvidence(source);
    if (!artifact || artifact.artifactRef !== input.artifactRef || artifact.integrityHash !== input.artifactContentHash) throw executionFailure("failed", "PRODUCTION_SOURCE_CHECKPOINT_ARTIFACT_UNAVAILABLE");
  }
  public createExecution(input: ExecutionInput): ProductGptExecution {
    const browsers = new ProductionGptBrowserLifecycle(this.browserAuthority, this.runtimeLogger, this.sourceHash, {
      jobId: input.jobId, attemptId: input.attemptId, resultRevision: input.resultRevision,
      domainRejectionRevision: input.domainRejectionRevision ?? false, deliveryPriorityReplayCalls: input.deliveryPriorityReplayCalls ?? [],
      deviceId: input.deviceId, leaseVersion: input.leaseVersion, executionFenceHash: input.executionFenceHash,
      capabilityManifestHash: input.capabilityManifestHash, get expiresAtMonotonic() { return input.expiresAtMonotonic; },
      get commandTtlMs() { return input.commandTtlMs; }, abortSignal: input.abortSignal,
      ...(input.providerContinuationParent ? { providerContinuationParent: input.providerContinuationParent } : {}) });
    const source = new ProductionGptSourceReuse(input, this.evidenceStore, this.browserAuthority);
    return new ProductionGptExecutionSession(input, browsers, this.evidenceStore, source, () => this.assertExecutionActive(input),
      (call, recorder) => this.executeOne(input, browsers, call, { recordConfirmedProviderEffectReadback: recorder }),
      (call, recorder) => this.readConfirmedSubmit(input, browsers, call, recorder)).createExecution();
  }
  private async readConfirmedSubmit(input: ExecutionInput, browsers: ProductionGptBrowserLifecycle,
    call: ConfirmedSubmitCall, recorder: ReadbackRecorder): Promise<ProductGptChildResult<"submit_exact_gpt_turn_once"> | null> {
    this.assertExecutionActive(input);
    const startedAt = new Date().toISOString(), intent = this.intentFor(input, call);
    const existing = this.browserAuthority.readProviderEffectStepCallFact({ jobId: input.jobId, attemptId: input.attemptId,
      resultRevision: input.resultRevision, productStepId: call.productStepId, callId: call.callId, childCapabilityId: call.child });
    if (!existing) return null;
    const prior = existing.mutation;
    if (prior.outcome === "REJECTED" && prior.mutationOutcome === "no" && prior.physicalInputCount === 0
      && input.deliveryPriorityReplayCalls?.some(risk => risk.productStepId === call.productStepId
        && risk.callId === call.callId && risk.childCapabilityId === call.child)) return null;
    const { atomicIdentity, exactCallIdentityHash } = confirmedSubmitIdentity(input, call, existing);
    const effect = submitEffect(prior, exactCallIdentityHash, call.child);
    try {
      if (prior.outcome !== "CONFIRMED") throw executionFailure("failed", "PROVIDER_EFFECT_OUTCOME_UNPROVEN");
      const active = await browsers.browserForConfirmedReadback(call.sessionKey, call.productStepId, call.callId);
      if (!active.facade.readAtomicStepOutcome(atomicIdentity)) throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
      return await this.executeOne(input, browsers, call, { priorEffectKnown: true, browserAtomicIdentity: atomicIdentity,
        recordConfirmedProviderEffectReadback: recorder });
    } catch (error) { return this.handleConfirmedReadbackFailure(input, browsers, call, intent, startedAt, effect, error); }
  }
  private async handleConfirmedReadbackFailure(input: ExecutionInput, browsers: ProductionGptBrowserLifecycle,
    call: ConfirmedSubmitCall, intent: GptChildCapabilityIntent, startedAt: string,
    effect: ReturnType<typeof submitEffect>, error: unknown): Promise<never> {
    const code = failureCode(error), rateLimit = ["BROWSER_GPT_DIALOG_UNRECOGNIZED", "BROWSER_KNOWN_GPT_RATE_LIMIT"].includes(code);
    if (rateLimit && typedGptExecutionFailure(error)?.proofFacts?.browserFact?.knownGptRateLimitPreflightFact) throw error;
    if (rateLimit) {
      const failed = await failedGptChildExecutionResult({ intent, context: { dataDir: this.dataDir, signal: input.abortSignal }, startedAt, error });
      if (code === "BROWSER_KNOWN_GPT_RATE_LIMIT") {
        const closureError = await this.closeKnownRateLimitAndReadGate(input, browsers, call, failed);
        if (closureError) throw gptExecutionFailure(failureCode(closureError), { mutationOutcome: effect.mutationOutcome,
          evidence: { evidenceRef: effect.evidenceRef, evidenceHash: effect.evidenceHash }, browserEffect: effect, cause: closureError });
      }
      throwGptChildFailure(failed, failed.proof.evidenceRef, undefined, effect);
    }
    throw gptExecutionFailure(failureCode(error, effect.browserOutcome === "CONFIRMED"
      ? "GPT_CONFIRMED_SUBMIT_READBACK_FAILED" : "PROVIDER_EFFECT_OUTCOME_UNPROVEN"), {
      mutationOutcome: effect.mutationOutcome, evidence: { evidenceRef: effect.evidenceRef, evidenceHash: effect.evidenceHash }, browserEffect: effect, cause: error });
  }
  public async reconcilePendingProviderRateLimitIncidents(_parentSpanId: string, _signal: AbortSignal): Promise<void> {
    for (const pending of this.providerRateLimitControl.pendingIncidents()) {
      const incident = await this.providerRateLimitControl.beginIncident(pending);
      let terminal: Readonly<{ terminalAt: string }> | null;
      try { terminal = this.browserAuthority.readConfirmedRateLimitAcknowledgement({ jobId: pending.jobId, attemptId: pending.attemptId,
        resultRevision: pending.resultRevision, incidentRequestId: incident.incidentRequestId }); }
      catch (error) { await incident.deliver(notClearedRateLimit(incident, pending.observedAt)); throw error; }
      if (!terminal) { await incident.deliver(notClearedRateLimit(incident, pending.observedAt)); continue; }
      await incident.deliver({ clearance: "confirmed_absent", acknowledgementReceiptHash: confirmedRateLimitAckHash(
        incident.incidentRequestId, terminal.terminalAt), acknowledgedAt: terminal.terminalAt });
    }
  }
  private assertExecutionActive(input: ExecutionInput): void {
    if (input.abortSignal.aborted) throw executionFailure("failed", typeof input.abortSignal.reason === "string" ? input.abortSignal.reason : "PRODUCTION_EXECUTION_ABORTED");
  }
  private intentFor<K extends GptChildCapabilityId>(execution: ExecutionInput, call: ProductGptCallInput<K>): GptChildCapabilityIntent<K> {
    const identity = { jobId: execution.jobId, attemptId: execution.attemptId, resultRevision: execution.resultRevision,
      productStepId: call.productStepId, callId: call.callId, childCapabilityId: call.child, inputHash: gptCanonicalHash(call.input) };
    return Object.freeze({ ...identity, executionId: `gpt-call:${gptExactCallIdentityHash(identity).slice(7)}`,
      actionOrdinal: call.actionOrdinal, input: call.input });
  }
  private childSpan(input: ExecutionInput, intent: GptChildCapabilityIntent): RuntimeSpanHandle {
    return requireRuntimeLogWrite(this.runtimeLogger.startSpan({ traceId: input.jobId, parentSpanId: input.parentSpanId,
      boundaryId: intent.executionId, owner: "gpt", component: "gpt-child", operation: "gpt.child", typedIdentity: { kind: "gpt-call",
        jobId: input.jobId, attemptId: input.attemptId, stepId: intent.productStepId, capabilityCallId: `${intent.callId}:${intent.childCapabilityId}` } }));
  }
  private assertProviderTurnBudget(execution: ExecutionInput, call: ProductGptCallInput<GptChildCapabilityId>): void {
    if (call.child !== "submit_exact_gpt_turn_once") return;
    this.providerRateLimitControl.assertProviderSubmitAllowed();
    if (this.browserAuthority.countProviderTurnDispatches(execution.jobId, execution.attemptId) >= execution.maxProviderTurns) throw executionFailure("failed", "PROVIDER_TURN_BUDGET_EXHAUSTED");
  }
  private async closeKnownRateLimitAndReadGate(execution: ExecutionInput, browsers: ProductionGptBrowserLifecycle,
    call: Readonly<{ sessionKey: string }>, result: GptChildCapabilityResult): Promise<unknown | null> {
    if (result.status === "success" || result.failureCode !== "BROWSER_KNOWN_GPT_RATE_LIMIT") return null;
    try { this.providerRateLimitControl.assertProviderSubmitAllowed(); }
    catch (error) { return failureCode(error) === "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE" ? null : error; }
    let closureError: unknown = executionFailure("failed", "PROVIDER_RATE_LIMIT_CLOSURE_DID_NOT_TERMINATE");
    try { await closeKnownProviderRateLimit({ execution, call, result, providerRateLimitControl: this.providerRateLimitControl,
      executeAcknowledgement: (ack, dispatchNotAfter) => this.executeOne(execution, browsers, ack, { rateLimitAckDispatchNotAfter: dispatchNotAfter }) }); }
    catch (error) { closureError = error; }
    try { this.providerRateLimitControl.assertProviderSubmitAllowed(); }
    catch (error) { if (failureCode(error) === "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE") return null; }
    return closureError;
  }
  private async executeOne<K extends GptChildCapabilityId>(execution: ExecutionInput, browsers: ProductionGptBrowserLifecycle,
    call: ProductGptCallInput<K> & Readonly<{ sessionKey: string }>, options: ExecuteOneOptions = {}): Promise<ProductGptChildResult<K>> {
    const intent = this.intentFor(execution, call), contract = GPT_CHILD_CAPABILITY_CONTRACTS[call.child];
    const startedAt = new Date().toISOString(), span = this.childSpan(execution, intent), priorEffectKnown = options.priorEffectKnown ?? false;
    let result: GptChildCapabilityResult;
    let browserCall: Awaited<ReturnType<ProductionGptBrowserLifecycle["browserFor"]>> | undefined;
    try {
      browserCall = await acquireProductionBrowserCall(browsers, call, contract.requiredTargetKind, priorEffectKnown);
      const recovered = await recoverPersistedTextCheckpoint({ evidenceStore: this.evidenceStore, execution, intent, call, browsers, browserCall, span });
      if (recovered) return recovered;
      if (!priorEffectKnown) this.assertProviderTurnBudget(execution, call);
      result = await runProductionAtomicPhase({ dataDir: this.dataDir, gpt: this.gpt, browsers, intent: intent as GptAnyChildCapabilityIntent,
        browserCall, signal: execution.abortSignal, resultRevision: execution.resultRevision, childCapabilityId: call.child,
        ...(options.browserAtomicIdentity ? { browserAtomicIdentity: options.browserAtomicIdentity } : {}),
        ...(options.recordConfirmedProviderEffectReadback ? { recordConfirmedProviderEffectReadback: options.recordConfirmedProviderEffectReadback } : {}),
        assertProviderInputAllowed: () => this.providerRateLimitControl.assertProviderSubmitAllowed(),
        ...(options.rateLimitAckDispatchNotAfter === undefined ? {} : { rateLimitAckDispatchNotAfter: options.rateLimitAckDispatchNotAfter }) });
    } catch (error) {
      result = await handleGptChildExecutionError({ dataDir: this.dataDir, execution, intent: intent as GptAnyChildCapabilityIntent,
        startedAt, error, browserCall, browserAtomicIdentity: options.browserAtomicIdentity, span, childCapabilityId: call.child });
    }
    const confirmedEffect = browserCall?.confirmedProviderEffect ?? null;
    if (call.child !== "acknowledge_known_gpt_rate_limit") {
      const closureError = await this.closeKnownRateLimitAndReadGate(execution, browsers, call, result);
      if (closureError) return terminalizeGptChildError(span, closureError, confirmedEffect);
    }
    let persisted: Awaited<ReturnType<typeof persistGptChildOutcome>>;
    try { persisted = await persistGptChildOutcome({ call, result, intent: intent as GptAnyChildCapabilityIntent,
      execution, browsers, browserCall, evidenceStore: this.evidenceStore,
      ...(options.browserAtomicIdentity ? { browserAtomicIdentity: options.browserAtomicIdentity } : {}) }); }
    catch (error) { return terminalizeGptChildError(span, error, confirmedEffect); }
    const terminalEventId = terminalizeGptChildResult(span, result);
    if (result.status !== "success") throwGptChildFailure(result, persisted.evidenceRef, terminalEventId,
      result.failureCode === "BROWSER_GPT_DIALOG_UNRECOGNIZED" ? null : confirmedEffect);
    recordSettledProviderResult(call, result.value, browsers, browserCall);
    return productChildResult({ execution, intent, value: result.value, browserFact: result.proof.browserFact, ...persisted });
  }
}
export const createProductionGptChildTools = (...input: ConstructorParameters<typeof ProductionGptChildTools>): ProductionGptChildTools => new ProductionGptChildTools(...input);
