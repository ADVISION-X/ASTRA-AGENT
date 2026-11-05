import type { GptExecutionProfile } from "./schema.js";
import type { GptExecutionContext, GptHash, ProductGptChildCapabilityId } from "./contract.js";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import type { GptEvidenceStorePort, GptProductionExecutionInput } from "./production-ports.js";
import { ProductionGptBrowserLifecycle, type ProductionGptBrowserCall } from "./production-browser-lifecycle.js";
import type { BrowserAtomicStepIdentity } from "../../lib/browser/browser-authority-api.js";
import { executionFailure, typedExecutionFailure, failureCode, executionFailureMetadata } from "../../lib/execution-failure.js";
import { runtimeFailureFromError, runtimeLogCauseEventId, withRuntimeLogCause } from "../../lib/runtime-logs/index.js";
import { imageResponseFromEvidence, readPersistedGptImageEvidence,
  readPersistedGptTextResponse } from "./evidence-artifacts.js";
import { isProviderEffectReadbackProofV1, providerEffectReadbackProofHash,
  type ProductGptExecution, type ProviderEffectReadbackProofV1 } from "./production-child-support.js";
import { ProductionGptSourceReuse, productionCallKey } from "./production-execution-source-reuse.js";

type ExecutionInput = GptProductionExecutionInput;
type ConfirmedSubmitCall = ProductGptCallInput<"submit_exact_gpt_turn_once"> & Readonly<{ sessionKey: string }>;
type ReadbackRecorder = NonNullable<GptExecutionContext["recordConfirmedProviderEffectReadback"]>;
type SessionCall<K extends ProductGptChildCapabilityId> = ProductGptCallInput<K>
  & Readonly<{ sessionKey: string }>;
type SubmittedStep = Readonly<{
  providerEffectIdentityHash: GptHash; browserAuthorityHash: GptHash;
  browserAuthorityRef: string; submitPromptHash: GptHash;
  canonicalConversationUrl: string | null; userTurnId: string;
  sourceAttemptId: string; sourceResultRevision: number;
  submitIdentity: BrowserAtomicStepIdentity | null; submitExactCallIdentityHash: GptHash;
  sourceReadback?: NonNullable<NonNullable<ExecutionInput["readbackOnlyCalls"]>[number]["source"]>;
  approvedProfile?: GptExecutionProfile;
  terminalAt: string | null; settledResultPayloadHash: GptHash | null;
}>;

const confirmedSubmissionFor = (submit: SubmittedStep | undefined): ProductionGptBrowserCall["confirmedProviderEffect"] => {
  return submit?.submitIdentity ? Object.freeze({
      exactCallIdentityHash: submit.submitExactCallIdentityHash,
      childCapabilityId: "submit_exact_gpt_turn_once" as const,
      effectScope: "provider_effect" as const, browserOutcome: "CONFIRMED" as const,
      mutationOutcome: "confirmed" as const, providerEffectIdentityHash: submit.providerEffectIdentityHash,
      evidenceRef: submit.browserAuthorityRef, evidenceHash: submit.browserAuthorityHash,
      terminalAt: submit.terminalAt, submitIdentity: submit.submitIdentity,
      canonicalConversationUrl: submit.canonicalConversationUrl, userTurnId: submit.userTurnId,
      ...(submit.sourceReadback ? { sourceReadback: submit.sourceReadback } : {}),
    }) : null;
};

/** Per-attempt GPT order and readback state; the Browser remains the sole effect Owner. */
export class ProductionGptExecutionSession {
  private readonly source: ProductionGptSourceReuse;
  private readonly riskCalls: Map<string, NonNullable<ExecutionInput["deliveryPriorityReplayCalls"]>[number]>;
  private readonly riskCompletedKeys = new Set<string>();
  private readonly riskSubmittedByStep = new Map<string, string>();
  private readonly pendingReadbacks: Map<string, NonNullable<ExecutionInput["readbackOnlyCalls"]>[number]>;
  private readonly approvedProfiles = new Map<string, GptExecutionProfile>();
  private readonly submittedByStep = new Map<string, SubmittedStep>();
  private readonly proofByEffect = new Map<string, ProviderEffectReadbackProofV1>();
  private providerEffectReadbackProof: ProviderEffectReadbackProofV1 | null = null;
  private activeReadback: Readonly<{ key: string; productStepId: string;
    canonicalConversationUrl: string | null; userTurnId: string }> | null = null;

  public constructor(
    private readonly input: ExecutionInput,
    private readonly browsers: ProductionGptBrowserLifecycle,
    private readonly evidenceStore: GptEvidenceStorePort,
    source: ProductionGptSourceReuse,
    private readonly assertActive: () => void,
    private readonly executeOne: <K extends ProductGptChildCapabilityId>(
      call: SessionCall<K>, recorder: ReadbackRecorder, state: Readonly<{
        confirmedSubmission: ProductionGptBrowserCall["confirmedProviderEffect"];
        stoppedEmptyRepair?: Readonly<{ profile: GptExecutionProfile; promptHash: GptHash }>;
        recordSubmitIdentity: (identity: BrowserAtomicStepIdentity) => void;
      }>,
    ) => Promise<ProductGptChildResult<K>>,
    private readonly readExistingSubmit: (
      call: ConfirmedSubmitCall, recorder: ReadbackRecorder,
      recordSubmitIdentity: (identity: BrowserAtomicStepIdentity) => void,
    ) => Promise<ProductGptChildResult<"submit_exact_gpt_turn_once"> | null>,
  ) {
    this.source = source;
    this.riskCalls = new Map((input.deliveryPriorityReplayCalls ?? []).map((call) =>
      [productionCallKey(call), call]));
    this.pendingReadbacks = new Map((input.readbackOnlyCalls ?? []).map((call) =>
      [productionCallKey(call), call]));
    if (this.riskCalls.size !== (input.deliveryPriorityReplayCalls?.length ?? 0)
      || input.sourceReuseZeroSubmitGrant === true
        && (this.source.size === 0 || input.deliveryPriorityReplayCalls?.length !== 0)
      || this.source.size > 0 && (input.domainRejectionRevision
        || !input.deliveryPriorityReplayCalls?.length && input.sourceReuseZeroSubmitGrant !== true)) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_AUTHORITY_INVALID");
    }
  }

  public createExecution(): ProductGptExecution {
    return Object.freeze({
      tools: Object.freeze({
        jobId: this.input.jobId, attemptId: this.input.attemptId,
        execute: <K extends ProductGptChildCapabilityId>(call: SessionCall<K>) => this.execute(call),
        readConfirmedSubmit: (call: ConfirmedSubmitCall) => this.readConfirmedSubmit(call),
      }),
      readProviderEffectReadbackProof: () => this.providerEffectReadbackProof,
      decorateSettledResultFailure: (error: unknown) => this.decorateSettledResultFailure(error),
      settle: async (error: unknown | null) => {
        try { await this.browsers.settle(error); } finally { this.submittedByStep.clear(); this.approvedProfiles.clear(); }
      },
    });
  }

  private readonly recordConfirmedProviderEffectReadback: ReadbackRecorder = (raw) => {
    const body = Object.freeze({
      schema_version: "provider-effect-readback-proof.v1" as const,
      job_id: raw.jobId, attempt_id: raw.attemptId, result_revision: raw.resultRevision,
      provider_effect_identity_hash: raw.providerEffectIdentityHash,
      exact_call_identity_hash: raw.exactCallIdentityHash,
      browser_authority_ref: raw.browserAuthorityRef,
      browser_authority_hash: raw.browserAuthorityHash,
      readback_provider_input_delta: raw.readbackProviderInputDelta,
    });
    const next = Object.freeze({ ...body, proof_hash: providerEffectReadbackProofHash(body) });
    const prior = this.proofByEffect.get(next.provider_effect_identity_hash);
    if (!isProviderEffectReadbackProofV1(next)
      || (prior && prior.proof_hash !== next.proof_hash)) {
      throw executionFailure("failed", "PROVIDER_EFFECT_READBACK_PROOF_CONFLICT");
    }
    this.proofByEffect.set(next.provider_effect_identity_hash, next);
    this.providerEffectReadbackProof = next;
  };

  private historicalCallsPending(): boolean {
    return this.riskCalls.size > this.riskCompletedKeys.size || this.source.hasPending;
  }

  private assertExecutionCall<K extends ProductGptChildCapabilityId>(call: SessionCall<K>): void {
    const sourceForStep = this.source.pendingForStep(call.productStepId);
    if (call.child === "submit_exact_gpt_turn_once" && this.input.readbackOnlyCalls?.some((entry) =>
      entry.productStepId === call.productStepId && entry.callId === call.callId && entry.childCapabilityId === call.child)) {
      throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_ONLY");
    }
    if (this.input.sourceReuseZeroSubmitGrant === true && !sourceForStep) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
    }
    if (this.riskCalls.size > 0 && this.historicalCallsPending()
      && (call.child === "submit_exact_gpt_turn_once"
        && !this.riskCalls.has(productionCallKey({ productStepId: call.productStepId,
          callId: call.callId, childCapabilityId: call.child }))
        || ![...this.riskCalls.values(), ...this.source.calls.values(), ...this.pendingReadbacks.values()].some((historical) =>
          historical.productStepId === call.productStepId))) {
      throw executionFailure("failed", "PRODUCTION_REPLAY_GRANT_SOURCE_MISMATCH");
    }
  }

  private assertCheckpointReadback<K extends ProductGptChildCapabilityId>(
    call: SessionCall<K>, checkpoint: boolean,
  ): void {
    if (this.pendingReadbacks.size > 0 && (!this.activeReadback
      || call.productStepId !== this.activeReadback.productStepId
      || (!checkpoint && call.child !== "get_submitted_gpt_conversation_url"))) {
      throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_ONLY");
    }
    if (this.pendingReadbacks.size > 0 && checkpoint) {
      const checkpointInput = call.input as Readonly<{
        canonicalConversationUrl?: string; userTurnId?: string;
      }>;
      if (!this.activeReadback
        || checkpointInput.canonicalConversationUrl !== this.activeReadback.canonicalConversationUrl
        || checkpointInput.userTurnId !== this.activeReadback.userTurnId) {
        throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
      }
    }
  }

  private assertNewTurn(): void {
    if ([...this.submittedByStep.values()].some((submit) => !submit.settledResultPayloadHash)) {
      throw executionFailure("failed", "GPT_BROWSER_SESSION_TRANSITION_UNSETTLED");
    }
    this.browsers.assertProviderTurnSettled();
    this.submittedByStep.clear();
  }

  private decorateSettledResultFailure(error: unknown): unknown {
    const submit = [...this.submittedByStep.values()].at(-1);
    if (!submit || executionFailureMetadata(error)?.browserEffect?.childCapabilityId === "retry_exact_gpt_response_once") return error;
    const typed = typedExecutionFailure(error);
    const details = runtimeFailureFromError({ error, code: failureCode(error), responsibleOwner: "gpt" });
    const cause = typed ? Object.assign(new Error(typed.code, { cause: typed.cause }), {
      ...(details.nativeCause ? { code: details.nativeCause } : {}),
      ...(details.httpStatus === undefined ? {} : { httpStatus: details.httpStatus }),
    }) : error;
    const effect = Object.freeze({
      exactCallIdentityHash: submit.submitExactCallIdentityHash,
      childCapabilityId: "submit_exact_gpt_turn_once" as const,
      effectScope: "provider_effect" as const, browserOutcome: "CONFIRMED" as const,
      mutationOutcome: "confirmed" as const,
      providerEffectIdentityHash: submit.providerEffectIdentityHash,
      terminalAt: submit.terminalAt, evidenceRef: submit.browserAuthorityRef,
      evidenceHash: submit.browserAuthorityHash,
    });
    const failure = executionFailure("failed", submit.settledResultPayloadHash
      ? "RESULT_SETTLED_UNUSABLE" : failureCode(error), {
      cause,
      metadata: { ...executionFailureMetadata(error), mutationOutcome: "confirmed",
        evidence: { evidenceRef: submit.browserAuthorityRef, evidenceHash: submit.browserAuthorityHash },
        browserEffect: effect,
        ...(submit.settledResultPayloadHash ? { settledResultPayloadHash: submit.settledResultPayloadHash } : {}) },
    });
    const causedByEventId = runtimeLogCauseEventId(error);
    return causedByEventId ? withRuntimeLogCause(failure, causedByEventId) : failure;
  }

  private async execute<K extends ProductGptChildCapabilityId>(call: SessionCall<K>): Promise<ProductGptChildResult<K>> {
    if (call.child === "prepare_clean_gpt_chat" || call.child === "prepare_clean_gpt_work"
      || call.child === "submit_exact_gpt_turn_once") this.assertNewTurn();
    this.assertActive();
    this.assertExecutionCall(call);
    const currentKey = `${call.sessionKey}\u0000${call.productStepId}`;
    if (call.child === "prepare_clean_gpt_chat" || call.child === "prepare_clean_gpt_work") this.approvedProfiles.delete(currentKey);
    const currentSubmit = this.submittedByStep.get(currentKey);
    if (currentSubmit && (call.child === "checkpoint_gpt_text_response" || call.child === "checkpoint_gpt_generated_image")) {
      this.submittedByStep.set(currentKey, Object.freeze({ ...currentSubmit, settledResultPayloadHash: null }));
    }
    const sourceForStep = this.source.pendingForStep(call.productStepId);
    if (sourceForStep && call.child !== "get_submitted_gpt_conversation_url") {
      const result = await this.source.recoverCheckpoint(call, sourceForStep);
      this.captureCheckpointHash(call, result);
      return result;
    }
    const checkpoint = call.child === "checkpoint_gpt_text_response" || call.child === "checkpoint_gpt_generated_image";
    this.assertCheckpointReadback(call, checkpoint);
    const submit = this.submittedByStep.get(currentKey);
    const confirmedSubmission = confirmedSubmissionFor(submit);
    const locator = call.child === "get_submitted_gpt_conversation_url";
    if ((checkpoint || locator) && (!confirmedSubmission || checkpoint && !submit?.canonicalConversationUrl)) {
      throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
    }
    let submitIdentity: BrowserAtomicStepIdentity | null = null;
    const result = await this.executeOne(call, this.recordConfirmedProviderEffectReadback, {
      confirmedSubmission: checkpoint || locator ? confirmedSubmission : null,
      ...(call.child === "checkpoint_gpt_text_response" && submit?.approvedProfile
        ? { stoppedEmptyRepair: { profile: submit.approvedProfile, promptHash: submit.submitPromptHash } } : {}),
      recordSubmitIdentity: (identity) => { submitIdentity = identity; },
    });
    await this.recordExecutedResult(call, result, submitIdentity);
    return result;
  }

  private async recordExecutedResult<K extends ProductGptChildCapabilityId>(call: SessionCall<K>,
    result: ProductGptChildResult<K>, submitIdentity: BrowserAtomicStepIdentity | null): Promise<void> {
    if (call.child === "select_gpt_model_from_start_v3") this.approvedProfiles.set(
      `${call.sessionKey}\u0000${call.productStepId}`, Object.freeze({ ...(call.input as { profile: GptExecutionProfile }).profile }));
    if (call.child === "submit_exact_gpt_turn_once") {
      this.captureSubmit(call.sessionKey, call.productStepId,
        result as ProductGptChildResult<"submit_exact_gpt_turn_once">, submitIdentity, true);
      const riskKey = productionCallKey({ productStepId: call.productStepId, callId: call.callId, childCapabilityId: call.child });
      if (this.riskCalls.has(riskKey)) this.riskSubmittedByStep.set(`${call.sessionKey}\u0000${call.productStepId}`, riskKey);
    }
    if (call.child === "get_submitted_gpt_conversation_url") this.captureLocator(call as SessionCall<"get_submitted_gpt_conversation_url">,
      result as ProductGptChildResult<"get_submitted_gpt_conversation_url">);
    const checkpoint = call.child === "checkpoint_gpt_text_response" || call.child === "checkpoint_gpt_generated_image";
    if (checkpoint) await this.recordCheckpoint(call, result);
    if (this.pendingReadbacks.size > 0 && this.activeReadback && checkpoint) {
      this.pendingReadbacks.delete(this.activeReadback.key);
      this.activeReadback = null;
    }
  }

  private captureLocator(call: SessionCall<"get_submitted_gpt_conversation_url">,
    result: ProductGptChildResult<"get_submitted_gpt_conversation_url">): void {
    const key = `${call.sessionKey}\u0000${call.productStepId}`, submit = this.submittedByStep.get(key);
    if (!submit || submit.submitIdentity?.callId !== call.input.submitCallId
      || submit.providerEffectIdentityHash !== call.input.providerEffectIdentityHash
      || submit.userTurnId !== result.value.userTurnId || !result.value.canonicalConversationUrl) {
      throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
    }
    this.submittedByStep.set(key, Object.freeze({ ...submit, canonicalConversationUrl: result.value.canonicalConversationUrl }));
    if (this.activeReadback?.productStepId === call.productStepId) this.activeReadback = Object.freeze({
      ...this.activeReadback, canonicalConversationUrl: result.value.canonicalConversationUrl });
  }

  private async recordCheckpoint<K extends ProductGptChildCapabilityId>(
    call: SessionCall<K>, result: ProductGptChildResult<K>,
  ): Promise<void> {
    const stepKey = `${call.sessionKey}\u0000${call.productStepId}`;
    const submit = this.submittedByStep.get(stepKey);
    const checkpointInput = call.input as Readonly<{
      canonicalConversationUrl: string; userTurnId: string;
    }>;
    if (submit) {
      if (submit.canonicalConversationUrl !== checkpointInput.canonicalConversationUrl
        || submit.userTurnId !== checkpointInput.userTurnId) {
        throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
      }
      this.captureCheckpointHash(call, result);
    }
    if (submit && this.input.recordSettledCheckpoint) {
      const identity = { evidenceStore: this.evidenceStore, jobId: this.input.jobId,
        attemptId: submit.sourceReadback?.sourceAttemptId ?? this.input.attemptId,
        exactCallIdentityHash: result.exactCallIdentityHash };
      const image = call.child === "checkpoint_gpt_generated_image"
        ? await readPersistedGptImageEvidence(identity) : null;
      const text = call.child === "checkpoint_gpt_text_response"
        ? await readPersistedGptTextResponse(identity) : null;
      const recovered = image ?? text;
      if (!recovered || !result.artifactRefs.includes(image?.originalArtifactRef ?? recovered.artifactRef)) {
        throw executionFailure("failed", "EVIDENCE_ARTIFACT_READBACK_FAILED");
      }
      if (image) imageResponseFromEvidence(image, {
        canonicalConversationUrl: checkpointInput.canonicalConversationUrl, userTurnId: checkpointInput.userTurnId,
        turnMarker: (call.input as { turnMarker: string }).turnMarker,
      });
      const companions = this.source.recordCurrentCheckpointGroup(Object.freeze({
        providerEffectIdentityHash: submit.providerEffectIdentityHash, browserAuthorityRef: submit.browserAuthorityRef,
        browserAuthorityHash: submit.browserAuthorityHash, sourceAttemptId: submit.sourceAttemptId,
        sourceResultRevision: submit.sourceResultRevision, submitPromptHash: submit.submitPromptHash,
        userTurnId: submit.userTurnId, canonicalConversationUrl: checkpointInput.canonicalConversationUrl,
        checkpointExactCallIdentityHash: result.exactCallIdentityHash,
        artifactRef: recovered.artifactRef, artifactContentHash: recovered.integrityHash,
      }), submit.submitIdentity?.productStepId ?? call.productStepId);
      this.closeRetryReadbacks(companions);
    }
    const riskKey = this.riskSubmittedByStep.get(stepKey);
    if (riskKey) { this.riskCompletedKeys.add(riskKey); this.riskSubmittedByStep.delete(stepKey); }
  }

  private closeRetryReadbacks(members: ReturnType<ProductionGptSourceReuse["recordCurrentCheckpointGroup"]>): void {
    if (this.pendingReadbacks.size === 0) return;
    const keys: string[] = [];
    for (const { effect } of members) {
      const key = productionCallKey(effect), pending = this.pendingReadbacks.get(key);
      if (!pending || (pending.source && (pending.source.effectIdentityHash !== effect.effectIdentityHash
        || pending.source.sourceAttemptId !== effect.attemptId || pending.source.sourceResultRevision !== effect.resultRevision
        || pending.source.walAuthorityHash !== effect.walAuthorityHash))) {
        throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
      }
      keys.push(key);
    }
    for (const key of keys) this.pendingReadbacks.delete(key);
  }

  private captureCheckpointHash<K extends ProductGptChildCapabilityId>(
    call: SessionCall<K>, result: ProductGptChildResult<K>,
  ): void {
    const key = `${call.sessionKey}\u0000${call.productStepId}`, submit = this.submittedByStep.get(key);
    if (!submit) return;
    const value = result.value as Readonly<Record<string, unknown>>;
    const hash = call.child === "checkpoint_gpt_text_response" ? value.semanticTextHash : value.originalSha256;
    if (typeof hash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(hash)) {
      throw executionFailure("failed", "GPT_SETTLED_RESULT_PAYLOAD_HASH_INVALID");
    }
    this.browsers.recordSettledResult(submit.providerEffectIdentityHash, hash as GptHash,
      { sessionKey: call.sessionKey, canonicalConversationUrl: submit.canonicalConversationUrl });
    this.submittedByStep.set(key, Object.freeze({ ...submit, settledResultPayloadHash: hash as GptHash }));
  }

  private captureSubmit(sessionKey: string, productStepId: string,
    result: ProductGptChildResult<"submit_exact_gpt_turn_once">,
    submitIdentity: BrowserAtomicStepIdentity | null, currentInput = false): void {
    const receipt = result.effectReceipt, value = result.value;
    if (!receipt || receipt.outcome !== "CONFIRMED" || receipt.mutationOutcome !== "confirmed"
      || !receipt.providerEffectIdentityHash || !receipt.evidenceRef || !receipt.evidenceHash
      || !value.userTurnId || !value.promptHash) {
      throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
    }
    const source = [...this.source.calls.values()].find((row) =>
      row.productStepId === productStepId && row.sourceAttemptId === result.sourceAttemptId
        && row.effectIdentityHash === receipt.providerEffectIdentityHash && row.childCapabilityId === "submit_exact_gpt_turn_once");
    const sourceReadback = [...this.pendingReadbacks.values()].find((entry) => entry.productStepId === productStepId
      && entry.source?.effectIdentityHash === receipt.providerEffectIdentityHash)?.source;
    const approvedProfile = this.approvedProfiles.get(`${sessionKey}\u0000${productStepId}`);
    this.submittedByStep.set(`${sessionKey}\u0000${productStepId}`, Object.freeze({
      providerEffectIdentityHash: receipt.providerEffectIdentityHash,
      browserAuthorityHash: receipt.evidenceHash, browserAuthorityRef: receipt.evidenceRef,
      submitPromptHash: value.promptHash,
      canonicalConversationUrl: null, userTurnId: value.userTurnId,
      sourceAttemptId: result.sourceAttemptId,
      sourceResultRevision: sourceReadback?.sourceResultRevision ?? source?.sourceResultRevision ?? this.input.resultRevision,
      ...(sourceReadback ? { sourceReadback } : source ? { sourceReadback: {
        sourceAttemptId: source.sourceAttemptId, sourceResultRevision: source.sourceResultRevision,
        effectIdentityHash: source.effectIdentityHash, walAuthorityHash: source.walAuthorityHash } } : {}),
      ...(approvedProfile && currentInput && !this.proofByEffect.has(receipt.providerEffectIdentityHash)
        && result.sourceAttemptId === this.input.attemptId
        ? { approvedProfile } : {}),
      submitIdentity, submitExactCallIdentityHash: result.exactCallIdentityHash,
      terminalAt: receipt.terminalAt, settledResultPayloadHash: null,
    }));
  }

  private async readConfirmedSubmit(call: ConfirmedSubmitCall): Promise<
    ProductGptChildResult<"submit_exact_gpt_turn_once"> | null
  > {
    const stepKey = `${call.sessionKey}\u0000${call.productStepId}`;
    if ([...this.submittedByStep.entries()].some(([key, row]) => key !== stepKey && !row.settledResultPayloadHash)) {
      throw executionFailure("failed", "GPT_BROWSER_SESSION_TRANSITION_UNSETTLED");
    }
    if ([...this.submittedByStep.values()].every((row) => row.settledResultPayloadHash)) this.submittedByStep.clear();
    this.assertActive();
    const key = productionCallKey({ productStepId: call.productStepId, callId: call.callId, childCapabilityId: call.child });
    let submitIdentity: BrowserAtomicStepIdentity | null = null;
    const reusable = this.source.readConfirmedSubmit(call, (identity) => { submitIdentity = identity; });
    if (reusable) {
      this.captureSubmit(call.sessionKey, call.productStepId, reusable, submitIdentity);
      return reusable;
    }
    this.assertCurrentReadbackAllowed(call, key);
    const result = await this.readExistingSubmit(call, this.recordConfirmedProviderEffectReadback,
      (identity) => { submitIdentity = identity; });
    if (result) {
      this.captureSubmit(call.sessionKey, call.productStepId, result, submitIdentity);
      if (this.riskCalls.has(key)) this.riskSubmittedByStep.set(stepKey, key);
    }
    if (this.pendingReadbacks.size > 0 && !result) throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
    if (result && this.pendingReadbacks.size > 0) {
      this.activeReadback = Object.freeze({ key, productStepId: call.productStepId,
        canonicalConversationUrl: null, userTurnId: result.value.userTurnId });
    }
    return result;
  }

  private assertCurrentReadbackAllowed(call: ConfirmedSubmitCall, key: string): void {
    if (this.input.sourceReuseZeroSubmitGrant === true) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
    }
    if (this.riskCalls.size > 0 && this.historicalCallsPending() && !this.riskCalls.has(key)
      && !this.pendingReadbacks.has(key)) {
      throw executionFailure("failed", "PRODUCTION_REPLAY_GRANT_SOURCE_MISMATCH");
    }
    if (this.source.hasPendingStep(call.productStepId)) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_READBACK_ONLY");
    }
    if (this.pendingReadbacks.size > 0
      && (!this.pendingReadbacks.has(key)
        || this.activeReadback !== null && this.activeReadback.key !== key)) {
      throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
    }
  }
}
