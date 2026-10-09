import {
  GPT_CHILD_CAPABILITY_CONTRACTS, gptCanonicalHash, gptExactCallIdentityHash,
  type GptAbilityGroup, type GptAnyChildCapabilityIntent, type GptChildCapabilityId,
  type GptChildCapabilityIntent, type GptChildCapabilityResult, type GptExecutionContext, type GptHash,
} from "./contract.js";
import { executionFailure, failureCode } from "../../lib/execution-failure.js";
import { requireRuntimeLogWrite, type RuntimeLogger, type RuntimeSpanHandle } from "../../lib/runtime-logs/index.js";
import type { BrowserAtomicStepIdentity } from "../../lib/browser/browser-authority-api.js";
import { failedGptChildExecutionResult } from "./ability-group.js";
import { gptExecutionFailure, typedGptExecutionFailure } from "./execution-fault.js";
import { readPersistedGptImageEvidence, readPersistedGptTextResponse } from "./evidence-artifacts.js";
import { ProductionGptBrowserLifecycle, type ProductionGptBrowserCall } from "./production-browser-lifecycle.js";
import { acquireProductionBrowserCall, recoverPersistedCheckpoint, runProductionAtomicPhase } from "./production-call-preparation.js";
import { confirmedSubmitIdentity, persistGptChildOutcome, productChildResult,
  recordSettledProviderResult, submitEffect } from "./production-child-result.js";
import { handleGptChildExecutionError, terminalizeGptChildError, terminalizeGptChildResult,
  throwGptChildFailure, type ProductGptExecution } from "./production-child-support.js";
import { ProductionGptExecutionSession } from "./production-execution-session.js";
import { ProductionGptSourceReuse } from "./production-execution-source-reuse.js";
import { closeKnownProviderRateLimit, confirmedRateLimitAckHash, notClearedRateLimit } from "./production-rate-limit-closure.js";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import type { GptEvidenceStorePort, GptProductionBrowserAuthority, ProviderRateLimitControlPort,
  GptProductionExecutionInput as ExecutionInput } from "./production-ports.js";
export type { ProductGptExecution } from "./production-child-support.js";

type ReadbackRecorder = NonNullable<GptExecutionContext["recordConfirmedProviderEffectReadback"]>;
type SubmitCall = ProductGptCallInput<"submit_exact_gpt_turn_once"> & Readonly<{ sessionKey: string }>;
type ExecuteOptions = Readonly<{
  priorEffectKnown?: boolean; rateLimitAckDispatchNotAfter?: number;
  confirmedSubmission?: ProductionGptBrowserCall["confirmedProviderEffect"];
  browserAtomicIdentity?: BrowserAtomicStepIdentity;
  confirmedProviderEffectReadback?: GptExecutionContext["confirmedProviderEffectReadback"];
  recordConfirmedProviderEffectReadback?: ReadbackRecorder;
  recordSubmitIdentity?: (identity: BrowserAtomicStepIdentity) => void;
}>;

export class ProductionGptChildTools {
  public constructor(
    private readonly dataDir: string, private readonly sourceHash: GptHash,
    private readonly gpt: GptAbilityGroup, private readonly evidenceStore: GptEvidenceStorePort,
    private readonly browserAuthority: GptProductionBrowserAuthority,
    private readonly runtimeLogger: RuntimeLogger,
    private readonly providerRateLimitControl: ProviderRateLimitControlPort,
  ) {}

  public createExecution(input: ExecutionInput): ProductGptExecution {
    const browsers = new ProductionGptBrowserLifecycle(this.browserAuthority, this.runtimeLogger, this.sourceHash, {
      jobId: input.jobId, attemptId: input.attemptId, resultRevision: input.resultRevision,
      deviceId: input.deviceId, leaseVersion: input.leaseVersion, executionFenceHash: input.executionFenceHash,
      capabilityManifestHash: input.capabilityManifestHash,
      domainRejectionRevision: input.domainRejectionRevision ?? false,
      deliveryPriorityReplayCalls: input.deliveryPriorityReplayCalls ?? [],
      get expiresAtMonotonic() { return input.expiresAtMonotonic; },
      get commandTtlMs() { return input.commandTtlMs; }, abortSignal: input.abortSignal,
      ...(input.providerContinuationParent ? { providerContinuationParent: input.providerContinuationParent } : {}),
    });
    return new ProductionGptExecutionSession(
      input, browsers, this.evidenceStore,
      new ProductionGptSourceReuse(input, this.evidenceStore, this.browserAuthority),
      () => this.assertExecutionActive(input),
      (call, recorder, state) => this.executeOne(input, browsers, call,
        { ...state, recordConfirmedProviderEffectReadback: recorder }),
      (call, recorder, recordSubmitIdentity) => this.readConfirmedSubmit(input, browsers, call, recorder, recordSubmitIdentity),
    ).createExecution();
  }

  private async readConfirmedSubmit(
    input: ExecutionInput, browsers: ProductionGptBrowserLifecycle, call: SubmitCall,
    recorder: ReadbackRecorder, recordSubmitIdentity: (identity: BrowserAtomicStepIdentity) => void,
  ): Promise<ProductGptChildResult<"submit_exact_gpt_turn_once"> | null> {
    this.assertExecutionActive(input);
    const startedAt = new Date().toISOString();
    const existing = this.browserAuthority.readProviderEffectStepCallFact({
      jobId: input.jobId, attemptId: input.attemptId, resultRevision: input.resultRevision,
      productStepId: call.productStepId, callId: call.callId, childCapabilityId: call.child,
    });
    if (!existing) return null;
    const fact = existing.mutation;
    if (fact.outcome === "REJECTED" && fact.mutationOutcome === "no" && fact.physicalInputCount === 0
      && input.deliveryPriorityReplayCalls?.some(risk => risk.productStepId === call.productStepId
        && risk.callId === call.callId && risk.childCapabilityId === call.child)) return null;
    const effect = submitEffect(fact, existing.exactCallIdentityHash, call.child);
    try {
      if (fact.outcome !== "CONFIRMED") throw executionFailure("failed", "PROVIDER_EFFECT_OUTCOME_UNPROVEN");
      const { atomicIdentity, exactCallIdentityHash } = confirmedSubmitIdentity(input, call, existing);
      if (!existing.confirmedOutcome) throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
      const restoredCall = { ...call, actionOrdinal: atomicIdentity.actionOrdinal };
      return await this.executeOne(input, browsers, restoredCall, {
        priorEffectKnown: true, browserAtomicIdentity: atomicIdentity,
        confirmedProviderEffectReadback: Object.freeze({ outcome: existing.confirmedOutcome, exactCallIdentityHash }),
        recordConfirmedProviderEffectReadback: recorder, recordSubmitIdentity,
      });
    } catch (error) {
      return this.handleConfirmedReadbackFailure(input, browsers, call,
        this.intentFor(input, call), startedAt, effect, error);
    }
  }

  private async executeOne<K extends GptChildCapabilityId>(
    execution: ExecutionInput, browsers: ProductionGptBrowserLifecycle,
    call: ProductGptCallInput<K> & Readonly<{ sessionKey: string }>, options: ExecuteOptions = {},
  ): Promise<ProductGptChildResult<K>> {
    const intent = this.intentFor(execution, call);
    const span = this.childSpan(execution, intent), startedAt = new Date().toISOString();
    let browserCall: ProductionGptBrowserCall | undefined;
    let result: GptChildCapabilityResult;
    try {
      const recovered = await recoverPersistedCheckpoint({ evidenceStore: this.evidenceStore, execution, intent, call, span });
      if (recovered) return recovered;
      if (!options.confirmedProviderEffectReadback) browserCall = await acquireProductionBrowserCall(
        browsers, call, GPT_CHILD_CAPABILITY_CONTRACTS[call.child].requiredTargetKind,
        options.priorEffectKnown ?? false, options.confirmedSubmission,
      );
      this.assertProviderTurnBudget(execution, call, options.priorEffectKnown ?? false);
      result = await runProductionAtomicPhase({
        ...options, dataDir: this.dataDir, gpt: this.gpt, browsers,
        intent: intent as GptAnyChildCapabilityIntent, browserCall,
        signal: execution.abortSignal, resultRevision: execution.resultRevision, childCapabilityId: call.child,
        assertProviderInputAllowed: () => this.providerRateLimitControl.assertProviderSubmitAllowed(),
      });
    } catch (error) {
      if (options.confirmedSubmission
        && !["BROWSER_GPT_DIALOG_UNRECOGNIZED", "BROWSER_KNOWN_GPT_RATE_LIMIT"].includes(failureCode(error))) {
        return terminalizeGptChildError(span, error, options.confirmedSubmission);
      }
      result = await handleGptChildExecutionError({
        dataDir: this.dataDir, execution, intent: intent as GptAnyChildCapabilityIntent,
        startedAt, error, browserCall, browserAtomicIdentity: options.browserAtomicIdentity,
        span, childCapabilityId: call.child,
      });
    }
    const confirmedEffect = browserCall?.confirmedProviderEffect ?? options.confirmedSubmission ?? null;
    const closureError = await this.closeKnownRateLimitAndReadGate(execution, browsers, call, result);
    if (closureError) return terminalizeGptChildError(span, closureError, confirmedEffect);
    let persisted: Awaited<ReturnType<typeof persistGptChildOutcome>>;
    try {
      persisted = await persistGptChildOutcome({
        ...options, call, result, intent: intent as GptAnyChildCapabilityIntent,
        execution, browsers, browserCall, evidenceStore: this.evidenceStore,
      });
    } catch (error) { return terminalizeGptChildError(span, error, confirmedEffect); }
    const terminalEventId = terminalizeGptChildResult(span, result);
    if (result.status !== "success") throwGptChildFailure(result, persisted.evidenceRef, terminalEventId, confirmedEffect);
    recordSettledProviderResult(call, result.value, browsers, browserCall);
    if (call.child === "submit_exact_gpt_turn_once") {
      const identity = options.browserAtomicIdentity ?? browserCall?.confirmedProviderEffect?.submitIdentity;
      if (identity) options.recordSubmitIdentity?.(identity);
    }
    return productChildResult({ execution, intent, value: result.value, browserFact: result.proof.browserFact, ...persisted });
  }

  private async handleConfirmedReadbackFailure(
    input: ExecutionInput, browsers: ProductionGptBrowserLifecycle, call: SubmitCall,
    intent: GptChildCapabilityIntent, startedAt: string, effect: ReturnType<typeof submitEffect>, error: unknown,
  ): Promise<never> {
    const code = failureCode(error);
    const rateLimit = ["BROWSER_GPT_DIALOG_UNRECOGNIZED", "BROWSER_KNOWN_GPT_RATE_LIMIT"].includes(code);
    if (rateLimit && typedGptExecutionFailure(error)?.proofFacts?.browserFact?.knownGptRateLimitPreflightFact) throw error;
    if (rateLimit) {
      const failed = await failedGptChildExecutionResult({
        intent, context: { dataDir: this.dataDir, signal: input.abortSignal }, startedAt, error,
      });
      if (code === "BROWSER_KNOWN_GPT_RATE_LIMIT") {
        const closure = await this.closeKnownRateLimitAndReadGate(input, browsers, call, failed);
        if (closure) throw gptExecutionFailure(failureCode(closure), {
          mutationOutcome: effect.mutationOutcome,
          evidence: { evidenceRef: effect.evidenceRef, evidenceHash: effect.evidenceHash }, browserEffect: effect, cause: closure,
        });
      }
      throwGptChildFailure(failed, failed.proof.evidenceRef, undefined, effect);
    }
    throw gptExecutionFailure(failureCode(error, effect.browserOutcome === "CONFIRMED"
      ? "GPT_CONFIRMED_SUBMIT_READBACK_FAILED" : "PROVIDER_EFFECT_OUTCOME_UNPROVEN"), {
      mutationOutcome: effect.mutationOutcome, browserEffect: effect, cause: error,
      evidence: { evidenceRef: effect.evidenceRef, evidenceHash: effect.evidenceHash },
    });
  }

  private async closeKnownRateLimitAndReadGate(
    execution: ExecutionInput, browsers: ProductionGptBrowserLifecycle,
    call: Readonly<{ child: GptChildCapabilityId; sessionKey: string }>, result: GptChildCapabilityResult,
  ): Promise<unknown | null> {
    if (call.child === "acknowledge_known_gpt_rate_limit"
      || result.status === "success" || result.failureCode !== "BROWSER_KNOWN_GPT_RATE_LIMIT") return null;
    try { this.providerRateLimitControl.assertProviderSubmitAllowed(); }
    catch (error) { return failureCode(error) === "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE" ? null : error; }
    let closureError: unknown = executionFailure("failed", "PROVIDER_RATE_LIMIT_CLOSURE_DID_NOT_TERMINATE");
    try {
      await closeKnownProviderRateLimit({
        execution, call, result, providerRateLimitControl: this.providerRateLimitControl,
        executeAcknowledgement: (ack, dispatchNotAfter) => this.executeOne(execution, browsers, ack,
          { rateLimitAckDispatchNotAfter: dispatchNotAfter }),
      });
    } catch (error) { closureError = error; }
    try { this.providerRateLimitControl.assertProviderSubmitAllowed(); }
    catch (error) { if (failureCode(error) === "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE") return null; }
    return closureError;
  }

  public async verifySourceCheckpointArtifact(input: Readonly<{
    jobId: string; sourceAttemptId: string; checkpointExactCallIdentityHash: GptHash;
    artifactRef: string; artifactContentHash: GptHash;
  }>): Promise<void> {
    const query = { evidenceStore: this.evidenceStore, jobId: input.jobId,
      attemptId: input.sourceAttemptId, exactCallIdentityHash: input.checkpointExactCallIdentityHash };
    const artifact = await readPersistedGptTextResponse(query) ?? await readPersistedGptImageEvidence(query);
    if (!artifact || artifact.artifactRef !== input.artifactRef || artifact.integrityHash !== input.artifactContentHash) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_CHECKPOINT_ARTIFACT_UNAVAILABLE");
    }
  }

  public async reconcilePendingProviderRateLimitIncidents(_parentSpanId: string, _signal: AbortSignal): Promise<void> {
    for (const pending of this.providerRateLimitControl.pendingIncidents()) {
      const incident = await this.providerRateLimitControl.beginIncident(pending);
      let terminal: Readonly<{ terminalAt: string }> | null;
      try {
        terminal = this.browserAuthority.readConfirmedRateLimitAcknowledgement({
          jobId: pending.jobId, attemptId: pending.attemptId, resultRevision: pending.resultRevision,
          incidentRequestId: incident.incidentRequestId,
        });
      } catch (error) { await incident.deliver(notClearedRateLimit(incident, pending.observedAt)); throw error; }
      if (!terminal) { await incident.deliver(notClearedRateLimit(incident, pending.observedAt)); continue; }
      await incident.deliver({ clearance: "confirmed_absent", acknowledgedAt: terminal.terminalAt,
        acknowledgementReceiptHash: confirmedRateLimitAckHash(incident.incidentRequestId, terminal.terminalAt) });
    }
  }

  private assertExecutionActive(input: ExecutionInput): void {
    if (input.abortSignal.aborted) throw executionFailure("failed",
      typeof input.abortSignal.reason === "string" ? input.abortSignal.reason : "PRODUCTION_EXECUTION_ABORTED");
  }

  private assertProviderTurnBudget(execution: ExecutionInput, call: ProductGptCallInput<GptChildCapabilityId>, priorKnown: boolean): void {
    if (priorKnown || call.child !== "submit_exact_gpt_turn_once") return;
    this.providerRateLimitControl.assertProviderSubmitAllowed();
    if (this.browserAuthority.countProviderTurnDispatches(execution.jobId, execution.attemptId) >= execution.maxProviderTurns) {
      throw executionFailure("failed", "PROVIDER_TURN_BUDGET_EXHAUSTED");
    }
  }

  private intentFor<K extends GptChildCapabilityId>(input: ExecutionInput, call: ProductGptCallInput<K>): GptChildCapabilityIntent<K> {
    const identity = { jobId: input.jobId, attemptId: input.attemptId, resultRevision: input.resultRevision,
      productStepId: call.productStepId, callId: call.callId, childCapabilityId: call.child, inputHash: gptCanonicalHash(call.input) };
    return Object.freeze({ ...identity, actionOrdinal: call.actionOrdinal, input: call.input,
      executionId: `gpt-call:${gptExactCallIdentityHash(identity).slice(7)}` });
  }

  private childSpan(execution: ExecutionInput, intent: GptChildCapabilityIntent): RuntimeSpanHandle {
    return requireRuntimeLogWrite(this.runtimeLogger.startSpan({
      traceId: execution.jobId, parentSpanId: execution.parentSpanId,
      boundaryId: intent.executionId, owner: "gpt", component: "gpt-child", operation: "gpt.child",
      typedIdentity: { kind: "gpt-call", jobId: execution.jobId, attemptId: execution.attemptId,
        stepId: intent.productStepId, capabilityCallId: `${intent.callId}:${intent.childCapabilityId}` },
    }));
  }
}

export const createProductionGptChildTools = (...args: ConstructorParameters<typeof ProductionGptChildTools>): ProductionGptChildTools =>
  new ProductionGptChildTools(...args);
