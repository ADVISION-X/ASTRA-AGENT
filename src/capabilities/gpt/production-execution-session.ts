import type { GptExecutionContext, GptHash, ProductGptChildCapabilityId } from "./contract.js";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import type { GptEvidenceStorePort, GptProductionExecutionInput } from "./production-ports.js";
import { ProductionGptBrowserLifecycle } from "./production-browser-lifecycle.js";
import { executionFailure } from "../../lib/execution-failure.js";
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
  canonicalConversationUrl: string; userTurnId: string;
  sourceAttemptId: string; sourceResultRevision: number;
}>;

/** Per-attempt GPT order and readback state; the Browser remains the sole effect Owner. */
export class ProductionGptExecutionSession {
  private readonly source: ProductionGptSourceReuse;
  private readonly riskCalls: Map<string, NonNullable<ExecutionInput["deliveryPriorityReplayCalls"]>[number]>;
  private readonly riskCompletedKeys = new Set<string>();
  private readonly riskSubmittedByStep = new Map<string, string>();
  private readonly pendingReadbacks: Map<string, NonNullable<ExecutionInput["readbackOnlyCalls"]>[number]>;
  private readonly submittedByStep = new Map<string, SubmittedStep>();
  private readonly proofByEffect = new Map<string, ProviderEffectReadbackProofV1>();
  private providerEffectReadbackProof: ProviderEffectReadbackProofV1 | null = null;
  private activeReadback: Readonly<{ key: string; productStepId: string;
    canonicalConversationUrl: string; userTurnId: string }> | null = null;

  public constructor(
    private readonly input: ExecutionInput,
    private readonly browsers: ProductionGptBrowserLifecycle,
    private readonly evidenceStore: GptEvidenceStorePort,
    source: ProductionGptSourceReuse,
    private readonly assertActive: () => void,
    private readonly executeOne: <K extends ProductGptChildCapabilityId>(
      call: SessionCall<K>, recorder: ReadbackRecorder,
    ) => Promise<ProductGptChildResult<K>>,
    private readonly readExistingSubmit: (
      call: ConfirmedSubmitCall, recorder: ReadbackRecorder,
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
      decorateSettledResultFailure: (error: unknown) => this.browsers.decorateSettledResultFailure(error),
      settle: (error: unknown | null) => this.browsers.settle(error),
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
    if (this.input.sourceReuseZeroSubmitGrant === true && !sourceForStep) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
    }
    if (this.riskCalls.size > 0 && this.historicalCallsPending()
      && (call.child === "submit_exact_gpt_turn_once"
        && !this.riskCalls.has(productionCallKey({ productStepId: call.productStepId,
          callId: call.callId, childCapabilityId: call.child }))
        || ![...this.riskCalls.values(), ...this.source.calls.values()].some((historical) =>
          historical.productStepId === call.productStepId))) {
      throw executionFailure("failed", "PRODUCTION_REPLAY_GRANT_SOURCE_MISMATCH");
    }
  }

  private assertCheckpointReadback<K extends ProductGptChildCapabilityId>(
    call: SessionCall<K>, checkpoint: boolean,
  ): void {
    if (this.pendingReadbacks.size > 0 && (!this.activeReadback
      || call.productStepId !== this.activeReadback.productStepId || !checkpoint)) {
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

  private async execute<K extends ProductGptChildCapabilityId>(
    call: SessionCall<K>,
  ): Promise<ProductGptChildResult<K>> {
    this.assertActive();
    this.assertExecutionCall(call);
    const sourceForStep = this.source.pendingForStep(call.productStepId);
    if (sourceForStep) return this.source.recoverCheckpoint(call, sourceForStep);
    const checkpoint = call.child === "checkpoint_gpt_text_response"
      || call.child === "checkpoint_gpt_generated_image";
    this.assertCheckpointReadback(call, checkpoint);
    const result = await this.executeOne(call, this.recordConfirmedProviderEffectReadback);
    if (call.child === "submit_exact_gpt_turn_once") {
      this.captureSubmit(call.sessionKey, call.productStepId,
        result as ProductGptChildResult<"submit_exact_gpt_turn_once">);
      const riskKey = productionCallKey({ productStepId: call.productStepId,
        callId: call.callId, childCapabilityId: call.child });
      if (this.riskCalls.has(riskKey)) {
        this.riskSubmittedByStep.set(`${call.sessionKey}\u0000${call.productStepId}`, riskKey);
      }
    }
    if (checkpoint) await this.recordCheckpoint(call, result);
    if (this.pendingReadbacks.size > 0 && this.activeReadback && checkpoint) {
      this.pendingReadbacks.delete(this.activeReadback.key);
      this.activeReadback = null;
    }
    return result;
  }

  private async recordCheckpoint<K extends ProductGptChildCapabilityId>(
    call: SessionCall<K>, result: ProductGptChildResult<K>,
  ): Promise<void> {
    const stepKey = `${call.sessionKey}\u0000${call.productStepId}`;
    const submit = this.submittedByStep.get(stepKey);
    const checkpointInput = call.input as Readonly<{
      canonicalConversationUrl: string; userTurnId: string;
    }>;
    if (submit && this.input.recordSettledCheckpoint) {
      if (submit.canonicalConversationUrl !== checkpointInput.canonicalConversationUrl
        || submit.userTurnId !== checkpointInput.userTurnId) {
        throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
      }
      const identity = { evidenceStore: this.evidenceStore, jobId: this.input.jobId,
        attemptId: this.input.attemptId, exactCallIdentityHash: result.exactCallIdentityHash };
      const image = call.child === "checkpoint_gpt_generated_image"
        ? await readPersistedGptImageEvidence(identity) : null;
      const text = call.child === "checkpoint_gpt_text_response"
        ? await readPersistedGptTextResponse(identity) : null;
      const recovered = image ?? text;
      if (!recovered || !result.artifactRefs.includes(
        image?.originalArtifactRef ?? recovered.artifactRef)) {
        throw executionFailure("failed", "EVIDENCE_ARTIFACT_READBACK_FAILED");
      }
      if (image) imageResponseFromEvidence(image, {
        canonicalConversationUrl: checkpointInput.canonicalConversationUrl,
        userTurnId: checkpointInput.userTurnId,
        turnMarker: (call.input as { turnMarker: string }).turnMarker,
      });
      this.input.recordSettledCheckpoint(Object.freeze({
        ...submit,
        checkpointExactCallIdentityHash: result.exactCallIdentityHash,
        artifactRef: recovered.artifactRef, artifactContentHash: recovered.integrityHash,
      }));
    }
    this.submittedByStep.delete(stepKey);
    const riskKey = this.riskSubmittedByStep.get(stepKey);
    if (riskKey) { this.riskCompletedKeys.add(riskKey); this.riskSubmittedByStep.delete(stepKey); }
  }

  private captureSubmit(sessionKey: string, productStepId: string,
    result: ProductGptChildResult<"submit_exact_gpt_turn_once">): void {
    const receipt = result.effectReceipt, value = result.value;
    if (!receipt || receipt.outcome !== "CONFIRMED" || receipt.mutationOutcome !== "confirmed"
      || !receipt.providerEffectIdentityHash || !receipt.evidenceRef || !receipt.evidenceHash
      || !value.canonicalConversationUrl || !value.userTurnId || !value.promptHash) {
      throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
    }
    this.submittedByStep.set(`${sessionKey}\u0000${productStepId}`, Object.freeze({
      providerEffectIdentityHash: receipt.providerEffectIdentityHash,
      browserAuthorityHash: receipt.evidenceHash, browserAuthorityRef: receipt.evidenceRef,
      submitPromptHash: value.promptHash,
      canonicalConversationUrl: value.canonicalConversationUrl, userTurnId: value.userTurnId,
      sourceAttemptId: result.sourceAttemptId, sourceResultRevision: this.input.resultRevision,
    }));
  }

  private async readConfirmedSubmit(call: ConfirmedSubmitCall): Promise<
    ProductGptChildResult<"submit_exact_gpt_turn_once"> | null
  > {
    const key = productionCallKey({ productStepId: call.productStepId,
      callId: call.callId, childCapabilityId: call.child });
    const reusable = this.source.readConfirmedSubmit(call);
    if (reusable) return reusable;
    this.assertCurrentReadbackAllowed(call, key);
    const result = await this.readExistingSubmit(call, this.recordConfirmedProviderEffectReadback);
    if (result) {
      this.captureSubmit(call.sessionKey, call.productStepId, result);
      if (this.riskCalls.has(key)) {
        this.riskSubmittedByStep.set(`${call.sessionKey}\u0000${call.productStepId}`, key);
      }
    }
    if (this.pendingReadbacks.size > 0 && !result) {
      throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
    }
    if (result && this.pendingReadbacks.size > 0) {
      this.activeReadback = Object.freeze({ key, productStepId: call.productStepId,
        canonicalConversationUrl: result.value.canonicalConversationUrl,
        userTurnId: result.value.userTurnId });
    }
    return result;
  }

  private assertCurrentReadbackAllowed(call: ConfirmedSubmitCall, key: string): void {
    if (this.input.sourceReuseZeroSubmitGrant === true) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
    }
    if (this.riskCalls.size > 0 && this.historicalCallsPending() && !this.riskCalls.has(key)) {
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
