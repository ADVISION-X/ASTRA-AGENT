import type { GptExecutionProfile } from "./schema.js";
import { repairStoppedEmptyResponse } from "./production-stopped-empty-retry.js";
import {
  GPT_CHILD_CAPABILITY_CONTRACTS, gptCanonicalHash, gptExactCallIdentityHash,
  type GptAbilityGroup, type GptAnyChildCapabilityIntent, type GptChildCapabilityId,
  type GptChildCapabilityIntent, type GptChildCapabilityResult, type GptExecutionContext, type GptHash,
} from "./contract.js";
import { executionFailure, failureCode } from "../../lib/execution-failure.js";
import { requireRuntimeLogWrite, type RuntimeLogger, type RuntimeSpanHandle } from "../../lib/runtime-logs/index.js";
import { browserExactCallIdentityHash, type BrowserAtomicStepIdentity } from "../../lib/browser/browser-authority-api.js";
import { failedGptChildExecutionResult } from "./ability-group.js";
import { gptExecutionFailure, typedGptExecutionFailure } from "./execution-fault.js";
import { readAdoptedImageReference, readPersistedGptImageEvidence, readPersistedGptTextResponse } from "./evidence-artifacts.js";
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
  stoppedEmptyRepair?: Readonly<{ profile: GptExecutionProfile; promptHash: GptHash }>;
  stoppedEmptyRetryAuthorized?: boolean; stoppedEmptyConversationUrl?: string;
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
    const readback = input.readbackOnlyCalls?.find((entry) => entry.productStepId === call.productStepId
      && entry.callId === call.callId && entry.childCapabilityId === call.child);
    if (readback?.source) return this.readSourceSubmit(input, call, readback.source, recordSubmitIdentity);
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

  private readSourceSubmit(input: ExecutionInput, call: SubmitCall,
    source: NonNullable<NonNullable<ExecutionInput["readbackOnlyCalls"]>[number]["source"]>,
    recordSubmitIdentity: (identity: BrowserAtomicStepIdentity) => void,
  ): ProductGptChildResult<"submit_exact_gpt_turn_once"> {
    const original = this.browserAuthority.readSourceConfirmedProviderEffect({
      jobId: input.jobId, ...source, productStepId: call.productStepId,
      callId: call.callId, childCapabilityId: call.child,
    });
    const raw = original.terminalPayload;
    const value = raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw as Readonly<Record<string, unknown>> : null;
    if (!value || !Number.isSafeInteger(original.actionOrdinal) || original.actionOrdinal < 1
      || typeof value.promptHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value.promptHash)
      || typeof value.userTurnId !== "string"
      || value.exactCallIdentityHash !== original.exactCallIdentityHash
      || value.rawCount !== 1 || value.eligibleCount !== 1) {
      throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
    }
    recordSubmitIdentity(Object.freeze({ resultRevision: source.sourceResultRevision,
      productStepId: call.productStepId, callId: call.callId, childCapabilityId: call.child,
      actionOrdinal: original.actionOrdinal, inputHash: original.inputHash, replayPolicy: "provider-effect-once" }));
    return Object.freeze({ value: Object.freeze({ status: "CONFIRMED", promptHash: value.promptHash as GptHash,
      mutationSent: true, userTurnId: value.userTurnId }),
      sourceAttemptId: source.sourceAttemptId, exactCallIdentityHash: original.exactCallIdentityHash,
      evidenceRef: original.authorityRef, evidenceHash: original.authorityHash, artifactRefs: Object.freeze([]),
      effectReceipt: Object.freeze({ effectScope: "provider_effect", providerEffectIdentityHash: source.effectIdentityHash,
        outcome: "CONFIRMED", mutationOutcome: "confirmed", terminalAt: original.terminalAt,
        evidenceRef: original.authorityRef, evidenceHash: original.authorityHash }) });
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
      const source = options.confirmedSubmission?.sourceReadback;
      if (source) this.browserAuthority.readSourceConfirmedProviderEffect({
        jobId: execution.jobId, ...source,
        productStepId: options.confirmedSubmission!.submitIdentity.productStepId,
        callId: options.confirmedSubmission!.submitIdentity.callId,
        childCapabilityId: "submit_exact_gpt_turn_once",
      });
      const recovered = await recoverPersistedCheckpoint({ evidenceStore: this.evidenceStore, execution, intent, call, span,
        ...(options.confirmedSubmission ? { confirmedSubmission: options.confirmedSubmission } : {}) });
      if (recovered) return recovered;
      const submittedConversationLocator = call.child === "get_submitted_gpt_conversation_url"
        ? this.readSubmittedLocator(execution, call as ProductGptCallInput<"get_submitted_gpt_conversation_url">,
          options.confirmedSubmission) : null;
      if (!options.confirmedProviderEffectReadback && !submittedConversationLocator) browserCall = await acquireProductionBrowserCall(
        browsers, call, GPT_CHILD_CAPABILITY_CONTRACTS[call.child].requiredTargetKind,
        options.priorEffectKnown ?? false, options.confirmedSubmission,
      );
      this.assertProviderTurnBudget(execution, call, options.priorEffectKnown ?? false);
      result = await runProductionAtomicPhase({
        ...options, ...(submittedConversationLocator ? { submittedConversationLocator } : {}),
        dataDir: this.dataDir, gpt: this.gpt, browsers,
        intent: intent as GptAnyChildCapabilityIntent, browserCall,
        stoppedEmptyRetryAuthorized: options.stoppedEmptyRetryAuthorized ?? this.stoppedEmptyRepairAllowed(execution, call, options),
        signal: execution.abortSignal, resultRevision: execution.resultRevision, childCapabilityId: call.child,
        assertProviderInputAllowed: () => this.providerRateLimitControl.assertProviderSubmitAllowed(),
      });
      result = await this.repairTextResponse({ execution, browsers, call, options, intent: intent as GptAnyChildCapabilityIntent,
        browserCall, result });
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
    return this.settleChildOutcome({ execution, browsers, call, options, intent, span, browserCall, result });
  }

  private stoppedEmptyRepairAllowed(execution: ExecutionInput,
    call: ProductGptCallInput<GptChildCapabilityId>, options: ExecuteOptions): boolean {
    return call.child === "checkpoint_gpt_text_response" && options.stoppedEmptyRepair !== undefined
      && options.confirmedSubmission?.providerEffectIdentityHash != null
      && execution.sourceReuseZeroSubmitGrant !== true && !execution.sourceReusableCalls?.length
      && !execution.readbackOnlyCalls?.length && !execution.deliveryPriorityReplayCalls?.length;
  }

  private async repairTextResponse(input: Readonly<{
    execution: ExecutionInput; browsers: ProductionGptBrowserLifecycle;
    call: ProductGptCallInput<GptChildCapabilityId> & Readonly<{ sessionKey: string }>;
    options: ExecuteOptions; intent: GptAnyChildCapabilityIntent;
    browserCall: ProductionGptBrowserCall | undefined; result: GptChildCapabilityResult;
  }>): Promise<GptChildCapabilityResult> {
    const { execution, browsers, options } = input;
    if (!this.stoppedEmptyRepairAllowed(execution, input.call, options)
      || input.result.status !== "failed" || input.result.failureCode !== "GPT_TEXT_RESPONSE_EMPTY_ENDED") return input.result;
    const root = options.confirmedSubmission!, repair = options.stoppedEmptyRepair!;
    const childOptions: ExecuteOptions = { ...options, stoppedEmptyRetryAuthorized: true,
      stoppedEmptyConversationUrl: root.canonicalConversationUrl! };
    return repairStoppedEmptyResponse({ dataDir: this.dataDir, signal: execution.abortSignal,
      call: input.call as ProductGptCallInput<"checkpoint_gpt_text_response"> & { sessionKey: string },
      intent: input.intent, root, profile: repair.profile, promptHash: repair.promptHash, initial: input.result,
      readRetry: callId => this.browserAuthority.readProviderEffectStepCallFact({ ...execution,
        productStepId: input.call.productStepId, callId, childCapabilityId: "retry_exact_gpt_response_once" }),
      assertBudget: prior => this.assertProviderTurnBudget(execution, { child: "retry_exact_gpt_response_once" }, prior),
      executeMenu: call => this.executeOne(execution, browsers, call, childOptions),
      executeRetry: (call, prior) => this.executeStoppedEmptyRetry(execution, browsers, call, childOptions, prior),
      observe: readbackOnly => runProductionAtomicPhase({ ...childOptions,
        dataDir: this.dataDir, gpt: this.gpt, browsers, intent: input.intent, browserCall: input.browserCall,
        signal: execution.abortSignal, resultRevision: execution.resultRevision, childCapabilityId: input.call.child,
        stoppedEmptyRetryAuthorized: !readbackOnly,
        assertProviderInputAllowed: () => this.providerRateLimitControl.assertProviderSubmitAllowed() }),
    });
  }

  private async executeStoppedEmptyRetry(execution: ExecutionInput, browsers: ProductionGptBrowserLifecycle,
    call: ProductGptCallInput<"retry_exact_gpt_response_once"> & { sessionKey: string }, options: ExecuteOptions,
    prior: ReturnType<GptProductionBrowserAuthority["readProviderEffectStepCallFact"]>,
  ): Promise<ProductGptChildResult<"retry_exact_gpt_response_once">> {
    const zero = prior?.mutation.outcome === "REJECTED" && prior.mutation.mutationOutcome === "no"
      && prior.mutation.physicalInputCount === 0;
    if (!prior || zero) return this.executeOne(execution, browsers, call, options);
    const effect = submitEffect(prior.mutation, prior.exactCallIdentityHash, call.child);
    if (prior.mutation.outcome !== "CONFIRMED" || !prior.confirmedOutcome) {
      throw gptExecutionFailure("PROVIDER_EFFECT_OUTCOME_UNPROVEN", { mutationOutcome: effect.mutationOutcome,
        browserEffect: effect, evidence: { evidenceRef: effect.evidenceRef, evidenceHash: effect.evidenceHash } });
    }
    const restored = confirmedSubmitIdentity(execution, call, prior);
    return this.executeOne(execution, browsers, call, { ...options, priorEffectKnown: true,
      browserAtomicIdentity: restored.atomicIdentity,
      confirmedProviderEffectReadback: { outcome: prior.confirmedOutcome, exactCallIdentityHash: restored.exactCallIdentityHash } });
  }

  private readSubmittedLocator(execution: ExecutionInput,
    call: ProductGptCallInput<"get_submitted_gpt_conversation_url">,
    confirmed: ProductionGptBrowserCall["confirmedProviderEffect"] | undefined,
  ): GptExecutionContext["submittedConversationLocator"] | null {
    if (!confirmed || confirmed.submitIdentity.productStepId !== call.productStepId
      || confirmed.submitIdentity.callId !== call.input.submitCallId
      || confirmed.providerEffectIdentityHash !== call.input.providerEffectIdentityHash) {
      throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
    }
    const outcome = this.readConfirmedLocatorOutcome(execution, call, confirmed);
    const locator = outcome.conversationLocator;
    if (!locator && confirmed.sourceReadback) throw executionFailure("failed", "GPT_SUBMITTED_CONVERSATION_URL_INVALID");
    if (locator && (locator.userTurnId !== confirmed.userTurnId
      || locator.providerEffectIdentityHash !== confirmed.providerEffectIdentityHash)) {
      throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
    }
    return locator ?? null;
  }

  private readConfirmedLocatorOutcome(execution: ExecutionInput,
    call: ProductGptCallInput<"get_submitted_gpt_conversation_url">,
    confirmed: NonNullable<ProductionGptBrowserCall["confirmedProviderEffect"]>) {
    const source = confirmed.sourceReadback;
    const old = source ? this.browserAuthority.readSourceConfirmedProviderEffect({ jobId: execution.jobId, ...source,
      productStepId: call.productStepId, callId: call.input.submitCallId, childCapabilityId: "submit_exact_gpt_turn_once" }) : null;
    const current = source ? null : this.browserAuthority.readProviderEffectStepCallFact({ ...execution,
      productStepId: call.productStepId, callId: call.input.submitCallId, childCapabilityId: "submit_exact_gpt_turn_once" });
    const outcome = old ?? current?.confirmedOutcome;
    const expectedExact = browserExactCallIdentityHash({ jobId: execution.jobId, attemptId: execution.attemptId,
      writerFenceHash: execution.executionFenceHash, ...confirmed.submitIdentity });
    if (!outcome || (old ?? current)!.exactCallIdentityHash !== expectedExact
      || outcome.authorityRef !== confirmed.evidenceRef || outcome.authorityHash !== confirmed.evidenceHash
      || (current && current.mutation.providerEffectIdentityHash !== confirmed.providerEffectIdentityHash)) {
      throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
    }
    return outcome;
  }

  private async settleChildOutcome<K extends GptChildCapabilityId>(input: Readonly<{
    execution: ExecutionInput; browsers: ProductionGptBrowserLifecycle;
    call: ProductGptCallInput<K> & Readonly<{ sessionKey: string }>; options: ExecuteOptions;
    intent: GptChildCapabilityIntent<K>; span: RuntimeSpanHandle;
    browserCall: ProductionGptBrowserCall | undefined; result: GptChildCapabilityResult;
  }>): Promise<ProductGptChildResult<K>> {
    const { execution, browsers, call, options, intent, span, browserCall, result } = input;
    const retryEffect = result.proof.browserFact?.childCapabilityId === "retry_exact_gpt_response_once" ? result.proof.browserFact : null;
    const confirmedEffect = retryEffect ?? browserCall?.confirmedProviderEffect ?? options.confirmedSubmission ?? null;
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

  public readAdoptedImageReference(
    input: Omit<Parameters<typeof readAdoptedImageReference>[0], "evidenceStore">,
  ): Promise<string> {
    return readAdoptedImageReference({ ...input, evidenceStore: this.evidenceStore });
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
    let firstFailure: unknown = null;
    for (const pending of this.providerRateLimitControl.pendingIncidents()) {
      try {
        const incident = await this.providerRateLimitControl.beginIncident(pending);
        const terminal = this.browserAuthority.readConfirmedRateLimitAcknowledgement({
          jobId: pending.jobId, attemptId: pending.attemptId, resultRevision: pending.resultRevision,
          incidentRequestId: incident.incidentRequestId,
        });
        await incident.deliver(terminal ? { clearance: "confirmed_absent", acknowledgedAt: terminal.terminalAt,
          acknowledgementReceiptHash: confirmedRateLimitAckHash(incident.incidentRequestId, terminal.terminalAt) }
          : notClearedRateLimit(incident, pending.observedAt));
      } catch (error) {
        this.providerRateLimitControl.assertIncidentFailureIsolated(error);
        firstFailure ??= error;
      }
    }
    if (firstFailure !== null) throw firstFailure;
  }

  private assertExecutionActive(input: ExecutionInput): void {
    if (input.abortSignal.aborted) throw executionFailure("failed",
      typeof input.abortSignal.reason === "string" ? input.abortSignal.reason : "PRODUCTION_EXECUTION_ABORTED");
  }

  private assertProviderTurnBudget(execution: ExecutionInput, call: Readonly<{ child: GptChildCapabilityId }>, priorKnown: boolean): void {
    if (priorKnown || !["submit_exact_gpt_turn_once", "retry_exact_gpt_response_once"].includes(call.child)) return;
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
