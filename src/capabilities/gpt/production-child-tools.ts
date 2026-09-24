import { createHash } from "node:crypto";

import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  type GptAbilityGroup,
  type GptAnyChildCapabilityIntent,
  type GptChildCapabilityId,
  type GptChildCapabilityIntent,
  type GptChildCapabilityResult,
  type GptExecutionContext,
  type ProductGptChildCapabilityId,
} from "./contract.js";
import { failedGptChildExecutionResult } from "./ability-group.js";
import { gptExactCallIdentityHash } from "./contract.js";
import { gptCanonicalHash } from "./contract.js";
import {
  requireRuntimeLogWrite,
  type RuntimeLogger,
  type RuntimeSpanHandle,
} from "../../lib/runtime-logs/index.js";
import {
  executionFailure, failureCode,
} from "../../lib/execution-failure.js";
import type { BrowserAtomicStepIdentity } from "../../lib/browser/browser-authority-api.js";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import type { GptHash } from "./contract.js";
import {
  ProductionGptBrowserLifecycle,
} from "./production-browser-lifecycle.js";
import { productionGptAtomicIdentity } from "./production-atomic-call.js";
import { gptExecutionFailure, typedGptExecutionFailure } from "./execution-fault.js";
import {
  confirmedSubmitIdentity, persistGptChildOutcome, productChildResult,
  recordSettledProviderResult, submitEffect,
} from "./production-child-result.js";
import {
  acquireProductionBrowserCall, recoverPersistedTextCheckpoint, runProductionAtomicPhase,
} from "./production-call-preparation.js";
import { imageResponseFromEvidence, readPersistedGptImageEvidence,
  readPersistedGptTextResponse } from "./evidence-artifacts.js";
import type {
  GptEvidenceStorePort,
  GptProductionBrowserAuthority,
  ProviderRateLimitControlPort,
} from "./production-ports.js";
import {
  closeKnownProviderRateLimit, notClearedRateLimit,
} from "./production-rate-limit-closure.js";
import {
  throwGptChildFailure,
  isProviderEffectReadbackProofV1,
  providerEffectReadbackProofHash,
  handleGptChildExecutionError,
  terminalizeGptChildError,
  terminalizeGptChildResult,
  type ProviderEffectReadbackProofV1,
  type ProductGptExecution,
} from "./production-child-support.js";
import type { GptProductionExecutionInput as ExecutionInput } from "./production-ports.js";

export type { ProductGptExecution } from "./production-child-support.js";

type ExecuteOneOptions = Readonly<{
  priorEffectKnown?: boolean;
  rateLimitAckDispatchNotAfter?: number;
  browserAtomicIdentity?: BrowserAtomicStepIdentity;
  recordConfirmedProviderEffectReadback?: NonNullable<
    GptExecutionContext["recordConfirmedProviderEffectReadback"]
  >;
}>;
type ConfirmedSubmitCall = ProductGptCallInput<"submit_exact_gpt_turn_once"> & Readonly<{ sessionKey: string }>;
type ReadbackRecorder = NonNullable<GptExecutionContext["recordConfirmedProviderEffectReadback"]>;

export class ProductionGptChildTools {
  public constructor(
    private readonly dataDir: string,
    private readonly sourceHash: GptHash,
    private readonly gpt: GptAbilityGroup,
    private readonly evidenceStore: GptEvidenceStorePort,
    private readonly browserAuthority: GptProductionBrowserAuthority,
    private readonly runtimeLogger: RuntimeLogger,
    private readonly providerRateLimitControl: ProviderRateLimitControlPort,
  ) {}
  public async verifySourceCheckpointArtifact(input: Readonly<{
    jobId: string; sourceAttemptId: string;
    checkpointExactCallIdentityHash: GptHash;
    artifactRef: string; artifactContentHash: GptHash;
  }>): Promise<void> {
    const recovered = await readPersistedGptTextResponse({
      evidenceStore: this.evidenceStore, jobId: input.jobId,
      attemptId: input.sourceAttemptId,
      exactCallIdentityHash: input.checkpointExactCallIdentityHash,
    });
    const image = recovered ? null : await readPersistedGptImageEvidence({
      evidenceStore: this.evidenceStore, jobId: input.jobId,
      attemptId: input.sourceAttemptId,
      exactCallIdentityHash: input.checkpointExactCallIdentityHash,
    });
    const artifact = recovered ?? image;
    if (!artifact || artifact.artifactRef !== input.artifactRef
      || artifact.integrityHash !== input.artifactContentHash) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_CHECKPOINT_ARTIFACT_UNAVAILABLE");
    }
  }
  private browserLifecycle(input: ExecutionInput): ProductionGptBrowserLifecycle {
    return new ProductionGptBrowserLifecycle(
      this.browserAuthority,
      this.runtimeLogger,
      this.sourceHash,
      {
        jobId: input.jobId,
        attemptId: input.attemptId,
        resultRevision: input.resultRevision,
        domainRejectionRevision: input.domainRejectionRevision ?? false,
        deliveryPriorityReplayCalls: input.deliveryPriorityReplayCalls ?? [],
        deviceId: input.deviceId,
        leaseVersion: input.leaseVersion,
        executionFenceHash: input.executionFenceHash,
        capabilityManifestHash: input.capabilityManifestHash,
        get expiresAtMonotonic() { return input.expiresAtMonotonic; },
        get commandTtlMs() { return input.commandTtlMs; },
        abortSignal: input.abortSignal,
        ...(input.providerContinuationParent ? {
          providerContinuationParent: input.providerContinuationParent,
        } : {}),
      },
    );
  }
  public createExecution(input: ExecutionInput): ProductGptExecution {
    const browsers = this.browserLifecycle(input);
    const sourceReusableCalls = new Map((input.sourceReusableCalls ?? []).map((call) =>
      [[call.productStepId, call.callId, call.childCapabilityId].join("\u0000"), call]));
    const sourceCompletedKeys = new Set<string>();
    const riskCalls = new Map((input.deliveryPriorityReplayCalls ?? []).map((call) =>
      [[call.productStepId, call.callId, call.childCapabilityId].join("\u0000"), call]));
    const riskCompletedKeys = new Set<string>();
    const riskSubmittedByStep = new Map<string, string>();
    if (sourceReusableCalls.size !== (input.sourceReusableCalls?.length ?? 0)
      || riskCalls.size !== (input.deliveryPriorityReplayCalls?.length ?? 0)
      || input.sourceReuseZeroSubmitGrant === true
        && (sourceReusableCalls.size === 0 || input.deliveryPriorityReplayCalls?.length !== 0)
      || sourceReusableCalls.size > 0 && (input.domainRejectionRevision
        || !input.deliveryPriorityReplayCalls?.length && input.sourceReuseZeroSubmitGrant !== true)) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_AUTHORITY_INVALID");
    }
    const sourcePendingByStep = new Map<string, Readonly<{
      key: string;
      source: NonNullable<ExecutionInput["sourceReusableCalls"]>[number];
      canonicalConversationUrl: string; userTurnId: string;
    }>>();
    let providerEffectReadbackProof: ProviderEffectReadbackProofV1 | null = null;
    const proofByEffect = new Map<string, ProviderEffectReadbackProofV1>();
    const callKey = (call: Readonly<{ productStepId: string; callId: string;
      childCapabilityId: string }>): string =>
      [call.productStepId, call.callId, call.childCapabilityId].join("\u0000");
    const historicalCallsPending = (): boolean =>
      riskCalls.size > riskCompletedKeys.size || sourceReusableCalls.size > sourceCompletedKeys.size;
    const pendingReadbacks = new Map((input.readbackOnlyCalls ?? []).map((call) =>
      [callKey(call), call]));
    const submittedByStep = new Map<string, Readonly<{
      providerEffectIdentityHash: GptHash; browserAuthorityHash: GptHash;
      browserAuthorityRef: string; submitPromptHash: GptHash;
      canonicalConversationUrl: string; userTurnId: string;
      sourceAttemptId: string; sourceResultRevision: number;
    }>>();
    const captureSubmit = (sessionKey: string, productStepId: string,
      result: ProductGptChildResult<"submit_exact_gpt_turn_once">): void => {
      const receipt = result.effectReceipt;
      const value = result.value;
      if (!receipt || receipt.outcome !== "CONFIRMED"
        || receipt.mutationOutcome !== "confirmed"
        || !receipt.providerEffectIdentityHash || !receipt.evidenceRef
        || !receipt.evidenceHash || !value.canonicalConversationUrl
        || !value.userTurnId || !value.promptHash) {
        throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
      }
      submittedByStep.set(`${sessionKey}\u0000${productStepId}`, Object.freeze({
        providerEffectIdentityHash: receipt.providerEffectIdentityHash,
        browserAuthorityHash: receipt.evidenceHash,
        browserAuthorityRef: receipt.evidenceRef,
        submitPromptHash: value.promptHash,
        canonicalConversationUrl: value.canonicalConversationUrl,
        userTurnId: value.userTurnId,
        sourceAttemptId: result.sourceAttemptId,
        sourceResultRevision: input.resultRevision,
      }));
    };
    let activeReadback: Readonly<{ key: string; productStepId: string;
      canonicalConversationUrl: string; userTurnId: string }> | null = null;
    const recordConfirmedProviderEffectReadback: ReadbackRecorder = (raw) => {
      const body = Object.freeze({
        schema_version: "provider-effect-readback-proof.v1" as const,
        job_id: raw.jobId,
        attempt_id: raw.attemptId,
        result_revision: raw.resultRevision,
        provider_effect_identity_hash: raw.providerEffectIdentityHash,
        exact_call_identity_hash: raw.exactCallIdentityHash,
        browser_authority_ref: raw.browserAuthorityRef,
        browser_authority_hash: raw.browserAuthorityHash,
        readback_provider_input_delta: raw.readbackProviderInputDelta,
      });
      const next = Object.freeze({ ...body, proof_hash: providerEffectReadbackProofHash(body) });
      const prior = proofByEffect.get(next.provider_effect_identity_hash);
      if (!isProviderEffectReadbackProofV1(next)
        || (prior && prior.proof_hash !== next.proof_hash)) {
        throw executionFailure("failed", "PROVIDER_EFFECT_READBACK_PROOF_CONFLICT");
      }
      proofByEffect.set(next.provider_effect_identity_hash, next);
      providerEffectReadbackProof = next;
    };
    const execute = async <K extends ProductGptChildCapabilityId>(
      call: ProductGptCallInput<K> & Readonly<{ sessionKey: string }>,
    ): Promise<ProductGptChildResult<K>> => {
      this.assertExecutionActive(input);
      const sourceForStep = [...sourceReusableCalls.entries()].find(([key, source]) =>
        source.productStepId === call.productStepId && !sourceCompletedKeys.has(key))?.[1];
      if (input.sourceReuseZeroSubmitGrant === true && !sourceForStep) {
        throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
      }
      if (riskCalls.size > 0 && historicalCallsPending()
        && (call.child === "submit_exact_gpt_turn_once"
          && !riskCalls.has(callKey({ productStepId: call.productStepId,
            callId: call.callId, childCapabilityId: call.child }))
          || ![...riskCalls.values(), ...sourceReusableCalls.values()].some((historical) =>
            historical.productStepId === call.productStepId))) {
        throw executionFailure("failed", "PRODUCTION_REPLAY_GRANT_SOURCE_MISMATCH");
      }
      if (sourceForStep) {
        if (call.child !== "checkpoint_gpt_text_response"
          && call.child !== "checkpoint_gpt_generated_image") {
          throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_READBACK_ONLY");
        }
        const pending = sourcePendingByStep.get(`${call.sessionKey}\u0000${call.productStepId}`);
        const checkpointInput = call.input as Readonly<{
          canonicalConversationUrl: string; userTurnId: string; turnMarker?: string;
        }>;
        if (!pending || pending.source !== sourceForStep
          || pending.canonicalConversationUrl !== checkpointInput.canonicalConversationUrl
          || pending.userTurnId !== checkpointInput.userTurnId) {
          throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
        }
        const source = pending.source;
        const identity = { evidenceStore: this.evidenceStore, jobId: input.jobId,
          attemptId: source.sourceAttemptId,
          exactCallIdentityHash: source.checkpointExactCallIdentityHash };
        const image = call.child === "checkpoint_gpt_generated_image"
          ? await readPersistedGptImageEvidence(identity) : null;
        const text = call.child === "checkpoint_gpt_text_response"
          ? await readPersistedGptTextResponse(identity) : null;
        const recovered = image ?? text;
        if (!recovered || recovered.artifactRef !== source.artifactRef
          || recovered.integrityHash !== source.artifactContentHash) {
          throw executionFailure("failed", "PRODUCTION_SOURCE_CHECKPOINT_ARTIFACT_UNAVAILABLE");
        }
        const value = image
          ? imageResponseFromEvidence(image, {
            canonicalConversationUrl: checkpointInput.canonicalConversationUrl,
            userTurnId: checkpointInput.userTurnId,
            turnMarker: checkpointInput.turnMarker ?? "",
          }) : text!.value;
        const reused = Object.freeze({
          value, evidenceRef: recovered.artifactRef,
          evidenceHash: recovered.integrityHash,
          sourceAttemptId: source.sourceAttemptId,
          exactCallIdentityHash: source.checkpointExactCallIdentityHash,
          artifactRefs: Object.freeze([image?.originalArtifactRef ?? recovered.artifactRef]),
          effectReceipt: null,
        }) as ProductGptChildResult<K>;
        input.recordSettledCheckpoint?.(Object.freeze({
          providerEffectIdentityHash: source.effectIdentityHash,
          browserAuthorityHash: source.walAuthorityHash,
          browserAuthorityRef: `browser-source:${source.effectIdentityHash}`,
          sourceAttemptId: source.sourceAttemptId,
          sourceResultRevision: source.sourceResultRevision,
          checkpointExactCallIdentityHash: source.checkpointExactCallIdentityHash,
          artifactRef: source.artifactRef, artifactContentHash: source.artifactContentHash,
          submitPromptHash: source.submitPromptHash,
          canonicalConversationUrl: pending.canonicalConversationUrl,
          userTurnId: pending.userTurnId,
        }));
        sourcePendingByStep.delete(`${call.sessionKey}\u0000${call.productStepId}`);
        sourceCompletedKeys.add(pending.key);
        return reused;
      }
      const checkpoint = call.child === "checkpoint_gpt_text_response"
        || call.child === "checkpoint_gpt_generated_image";
      if (pendingReadbacks.size > 0 && (!activeReadback
        || call.productStepId !== activeReadback.productStepId || !checkpoint)) {
        throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_ONLY");
      }
      if (pendingReadbacks.size > 0 && checkpoint) {
        const checkpointInput = call.input as Readonly<{
          canonicalConversationUrl?: string; userTurnId?: string;
        }>;
        if (!activeReadback
          || checkpointInput.canonicalConversationUrl !== activeReadback.canonicalConversationUrl
          || checkpointInput.userTurnId !== activeReadback.userTurnId) {
          throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
        }
      }
      const result = await this.executeOne(input, browsers, call, {
        recordConfirmedProviderEffectReadback,
      });
      if (call.child === "submit_exact_gpt_turn_once") {
        captureSubmit(call.sessionKey, call.productStepId,
          result as ProductGptChildResult<"submit_exact_gpt_turn_once">);
        const riskKey = callKey({ productStepId: call.productStepId,
          callId: call.callId, childCapabilityId: call.child });
        if (riskCalls.has(riskKey)) {
          riskSubmittedByStep.set(`${call.sessionKey}\u0000${call.productStepId}`, riskKey);
        }
      }
      if (call.child === "checkpoint_gpt_text_response"
        || call.child === "checkpoint_gpt_generated_image") {
        const submit = submittedByStep.get(`${call.sessionKey}\u0000${call.productStepId}`);
        const checkpointInput = call.input as Readonly<{
          canonicalConversationUrl: string; userTurnId: string;
        }>;
        if (submit && input.recordSettledCheckpoint) {
          if (submit.canonicalConversationUrl !== checkpointInput.canonicalConversationUrl
            || submit.userTurnId !== checkpointInput.userTurnId) {
            throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
          }
          const identity = { evidenceStore: this.evidenceStore, jobId: input.jobId,
            attemptId: input.attemptId, exactCallIdentityHash: result.exactCallIdentityHash };
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
          input.recordSettledCheckpoint(Object.freeze({
            ...submit,
            checkpointExactCallIdentityHash: result.exactCallIdentityHash,
            artifactRef: recovered.artifactRef,
            artifactContentHash: recovered.integrityHash,
          }));
        }
        submittedByStep.delete(`${call.sessionKey}\u0000${call.productStepId}`);
        const riskKey = riskSubmittedByStep.get(`${call.sessionKey}\u0000${call.productStepId}`);
        if (riskKey) {
          riskCompletedKeys.add(riskKey);
          riskSubmittedByStep.delete(`${call.sessionKey}\u0000${call.productStepId}`);
        }
      }
      if (pendingReadbacks.size > 0 && activeReadback && checkpoint) {
        pendingReadbacks.delete(activeReadback.key);
        activeReadback = null;
      }
      return result as ProductGptChildResult<K>;
    };
    return Object.freeze({
      tools: Object.freeze({
        jobId: input.jobId,
        attemptId: input.attemptId,
        execute,
        readConfirmedSubmit: async (
          call: ConfirmedSubmitCall,
        ) => {
          const key = callKey({ productStepId: call.productStepId,
            callId: call.callId, childCapabilityId: call.child });
          const reusable = sourceReusableCalls.get(key);
          if (reusable) {
            if (sourceCompletedKeys.has(key)) {
              throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
            }
            const original = this.browserAuthority.readSourceConfirmedProviderEffect({
              jobId: input.jobId, sourceAttemptId: reusable.sourceAttemptId,
              sourceResultRevision: reusable.sourceResultRevision,
              productStepId: reusable.productStepId, callId: reusable.callId,
              childCapabilityId: reusable.childCapabilityId,
              effectIdentityHash: reusable.effectIdentityHash,
              walAuthorityHash: reusable.walAuthorityHash,
            });
            const raw = original.terminalPayload;
            const value = raw && typeof raw === "object" && !Array.isArray(raw)
              ? raw as Readonly<Record<string, unknown>> : null;
            const digest = (text: string): GptHash =>
              `sha256:${createHash("sha256").update(text).digest("hex")}`;
            if (!value || original.actionOrdinal !== call.actionOrdinal
              || value.promptHash !== reusable.submitPromptHash
              || typeof value.canonicalConversationUrl !== "string"
              || typeof value.userTurnId !== "string"
              || value.exactCallIdentityHash !== original.exactCallIdentityHash
              || value.rawCount !== 1 || value.eligibleCount !== 1
              || digest(value.canonicalConversationUrl) !== reusable.canonicalConversationHash
              || digest(value.userTurnId) !== reusable.userTurnHash) {
              throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
            }
            const result = Object.freeze({
              value: Object.freeze({ status: "CONFIRMED" as const,
                promptHash: reusable.submitPromptHash, mutationSent: true as const,
                canonicalConversationUrl: value.canonicalConversationUrl,
                userTurnId: value.userTurnId }),
              evidenceRef: original.authorityRef,
              evidenceHash: original.authorityHash,
              sourceAttemptId: reusable.sourceAttemptId,
              exactCallIdentityHash: original.exactCallIdentityHash,
              artifactRefs: Object.freeze([]),
              effectReceipt: Object.freeze({
                effectScope: "provider_effect" as const,
                providerEffectIdentityHash: reusable.effectIdentityHash,
                outcome: "CONFIRMED" as const, mutationOutcome: "confirmed" as const,
                terminalAt: original.terminalAt,
                evidenceRef: original.authorityRef, evidenceHash: original.authorityHash,
              }),
            });
            sourcePendingByStep.set(`${call.sessionKey}\u0000${call.productStepId}`,
              Object.freeze({ key, source: reusable,
                canonicalConversationUrl: value.canonicalConversationUrl,
                userTurnId: value.userTurnId }));
            return result;
          }
          if (input.sourceReuseZeroSubmitGrant === true) {
            throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_IDENTITY_MISMATCH");
          }
          if (riskCalls.size > 0 && historicalCallsPending()
            && !riskCalls.has(key)) {
            throw executionFailure("failed", "PRODUCTION_REPLAY_GRANT_SOURCE_MISMATCH");
          }
          if ([...sourceReusableCalls.entries()].some(([sourceKey, source]) =>
            source.productStepId === call.productStepId
            && !sourceCompletedKeys.has(sourceKey))) {
            throw executionFailure("failed", "PRODUCTION_SOURCE_REUSE_READBACK_ONLY");
          }
          if (pendingReadbacks.size > 0
            && (!pendingReadbacks.has(key)
              || activeReadback !== null && activeReadback.key !== key)) {
            throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
          }
          const result = await this.readConfirmedSubmit(
            input, browsers, call, recordConfirmedProviderEffectReadback,
          );
          if (result) {
            captureSubmit(call.sessionKey, call.productStepId, result);
            if (riskCalls.has(key)) {
              riskSubmittedByStep.set(`${call.sessionKey}\u0000${call.productStepId}`, key);
            }
          }
          if (pendingReadbacks.size > 0 && !result) {
            throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
          }
          if (result && pendingReadbacks.size > 0) {
            activeReadback = Object.freeze({ key, productStepId: call.productStepId,
              canonicalConversationUrl: result.value.canonicalConversationUrl,
              userTurnId: result.value.userTurnId,
            });
          }
          return result;
        },
      }),
      readProviderEffectReadbackProof: () => providerEffectReadbackProof,
      decorateSettledResultFailure: (error) => browsers.decorateSettledResultFailure(error),
      settle: (error) => browsers.settle(error),
    });
  }

  private async readConfirmedSubmit(
    input: ExecutionInput, browsers: ProductionGptBrowserLifecycle,
    call: ConfirmedSubmitCall,
    recordConfirmedProviderEffectReadback: ReadbackRecorder,
  ): Promise<ProductGptChildResult<"submit_exact_gpt_turn_once"> | null> {
    const startedAt = new Date().toISOString();
    this.assertExecutionActive(input);
    const intent = this.intentFor(input, call);
    const currentAtomicIdentity = productionGptAtomicIdentity(
      intent as GptAnyChildCapabilityIntent, input.resultRevision,
    );
    const existing = this.browserAuthority.readProviderEffectStepCallFact({
      jobId: input.jobId, attemptId: input.attemptId, resultRevision: input.resultRevision,
      productStepId: call.productStepId, callId: call.callId,
      childCapabilityId: call.child,
    });
    if (!existing) return null;
    const prior = existing.mutation;
    if (prior.outcome === "REJECTED" && prior.mutationOutcome === "no"
      && prior.physicalInputCount === 0
      && input.deliveryPriorityReplayCalls?.some((risk) =>
        risk.productStepId === call.productStepId && risk.callId === call.callId
        && risk.childCapabilityId === call.child)) return null;
    const { atomicIdentity, exactCallIdentityHash } = confirmedSubmitIdentity(input, call, existing);
    const effect = submitEffect(prior, exactCallIdentityHash, call.child);
    try {
      if (prior.outcome === "DISPATCHED"
        && existing.inputHash !== currentAtomicIdentity.inputHash) {
        throw executionFailure("failed", "PROVIDER_EFFECT_OUTCOME_UNPROVEN");
      }
      const active = await (prior.outcome === "CONFIRMED"
        ? browsers.browserForConfirmedReadback(
          call.sessionKey, call.productStepId, call.callId,
        ) : browsers.browserForRateLimitRecovery(
          call.sessionKey, call.productStepId, call.callId,
        ));
      if (!active.facade.readAtomicStepOutcome(atomicIdentity)) {
        throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
      }
      return await this.executeOne<"submit_exact_gpt_turn_once">(input, browsers, call, {
        priorEffectKnown: true, browserAtomicIdentity: atomicIdentity,
        recordConfirmedProviderEffectReadback,
      });
    } catch (error) {
      const code = failureCode(error);
      if ((code === "BROWSER_GPT_DIALOG_UNRECOGNIZED"
        || code === "BROWSER_KNOWN_GPT_RATE_LIMIT")
        && typedGptExecutionFailure(error)?.proofFacts?.browserFact
          ?.knownGptRateLimitPreflightFact) {
        throw error;
      }
      if (code === "BROWSER_GPT_DIALOG_UNRECOGNIZED"
        || code === "BROWSER_KNOWN_GPT_RATE_LIMIT") {
        const failed = await failedGptChildExecutionResult({
          intent,
          context: { dataDir: this.dataDir, signal: input.abortSignal },
          startedAt,
          error,
        });
        if (code === "BROWSER_KNOWN_GPT_RATE_LIMIT") {
          const closureError = await this.closeKnownRateLimitAndReadGate(
            input, browsers, call, failed,
          );
          if (closureError) {
            throw gptExecutionFailure(failureCode(closureError), {
              mutationOutcome: effect.mutationOutcome,
              evidence: { evidenceRef: effect.evidenceRef, evidenceHash: effect.evidenceHash },
              browserEffect: effect,
              cause: closureError,
            });
          }
        }
        throwGptChildFailure(failed, failed.proof.evidenceRef, undefined, effect);
      }
      throw gptExecutionFailure(failureCode(error, prior.outcome === "CONFIRMED"
        ? "GPT_CONFIRMED_SUBMIT_READBACK_FAILED" : "PROVIDER_EFFECT_OUTCOME_UNPROVEN"), {
        mutationOutcome: effect.mutationOutcome, evidence: {
          evidenceRef: effect.evidenceRef, evidenceHash: effect.evidenceHash,
        }, browserEffect: effect, cause: error,
      });
    }
  }

  public async reconcilePendingProviderRateLimitIncidents(
    parentSpanId: string,
    signal: AbortSignal,
  ): Promise<void> {
    for (const pending of this.providerRateLimitControl.pendingIncidents()) {
      const execution: ExecutionInput = {
        jobId: pending.jobId,
        productId: "runtime-provider-cooldown-recovery",
        ownerRef: "production-runtime",
        subjectRef: pending.jobId,
        authorizationRef: "provider-cooldown-recovery",
        resultRevision: pending.resultRevision,
        attemptId: pending.attemptId,
        deviceId: pending.deviceId,
        leaseVersion: pending.leaseVersion,
        executionFenceHash: pending.fenceHash,
        capabilityManifestHash: pending.capabilityManifestHash,
        maxProviderTurns: 1,
        expiresAtMonotonic: performance.now() + 30_000,
        commandTtlMs: 30_000,
        abortSignal: signal,
        parentSpanId,
      };
      const browsers = this.browserLifecycle(execution);
      const incident = await this.providerRateLimitControl.beginIncident(pending);
      try {
        const acknowledged = await this.executeOne(execution, browsers, {
            child: "acknowledge_known_gpt_rate_limit",
            sessionKey: pending.sessionKey,
            productStepId: "gpt-rate-limit-control",
            callId: incident.incidentRequestId,
            actionOrdinal: 1,
            input: {
              incidentRequestId: incident.incidentRequestId,
              dialogHash: pending.dialogHash,
              observationHash: pending.observationHash,
              targetRefHash: pending.targetRefHash,
              documentRefHash: pending.documentRefHash,
              observedAt: pending.observedAt,
            },
          }, { priorEffectKnown: true, rateLimitAckDispatchNotAfter: Date.parse(pending.observedAt) + 1_000 }).catch(async (error: unknown) => {
          await incident.deliver(notClearedRateLimit(incident, pending.observedAt));
          throw error;
        });
        await incident.deliver({
          clearance: acknowledged.value.clearance,
          acknowledgementReceiptHash: acknowledged.value.acknowledgementReceiptHash,
          acknowledgedAt: acknowledged.value.acknowledgedAt,
        });
      } finally {
        await browsers.settle(null);
      }
    }
  }

  private assertExecutionActive(input: ExecutionInput): void {
    if (!input.abortSignal.aborted) return;
    throw executionFailure("failed", typeof input.abortSignal.reason === "string"
      ? input.abortSignal.reason : "PRODUCTION_EXECUTION_ABORTED");
  }

  private intentForAttempt<K extends GptChildCapabilityId>(
    execution: ExecutionInput,
    call: ProductGptCallInput<K>,
    attemptId: string,
  ): GptChildCapabilityIntent<K> {
    const inputHash = gptCanonicalHash(call.input);
    const identity = {
      jobId: execution.jobId,
      attemptId,
      resultRevision: execution.resultRevision,
      productStepId: call.productStepId,
      callId: call.callId,
      childCapabilityId: call.child,
      inputHash,
    } as const;
    return Object.freeze({
      ...identity,
      executionId: `gpt-call:${gptExactCallIdentityHash(identity).slice(7)}`,
      actionOrdinal: call.actionOrdinal,
      input: call.input,
    });
  }
  private intentFor<K extends GptChildCapabilityId>(
    execution: ExecutionInput,
    call: ProductGptCallInput<K>,
  ): GptChildCapabilityIntent<K> {
    return this.intentForAttempt(execution, call, execution.attemptId);
  }
  private childSpan(input: ExecutionInput, intent: GptChildCapabilityIntent): RuntimeSpanHandle {
    return requireRuntimeLogWrite(this.runtimeLogger.startSpan({
      traceId: input.jobId,
      parentSpanId: input.parentSpanId,
      boundaryId: intent.executionId,
      owner: "gpt",
      component: "gpt-child",
      operation: "gpt.child",
      typedIdentity: {
        kind: "gpt-call",
        jobId: input.jobId,
        attemptId: input.attemptId,
        stepId: intent.productStepId,
        capabilityCallId: `${intent.callId}:${intent.childCapabilityId}`,
      },
    }));
  }

  private assertProviderTurnBudget(
    execution: ExecutionInput,
    call: ProductGptCallInput<GptChildCapabilityId>,
  ): void {
    if (call.child !== "submit_exact_gpt_turn_once") return;
    this.providerRateLimitControl.assertProviderSubmitAllowed();
    const dispatched = this.browserAuthority.countProviderTurnDispatches(
      execution.jobId,
      execution.attemptId,
    );
    if (dispatched >= execution.maxProviderTurns) {
      throw executionFailure("failed", "PROVIDER_TURN_BUDGET_EXHAUSTED");
    }
  }

  private async closeKnownRateLimitAndReadGate(
    execution: ExecutionInput,
    browsers: ProductionGptBrowserLifecycle,
    call: Readonly<{ sessionKey: string }>,
    result: GptChildCapabilityResult,
  ): Promise<unknown | null> {
    if (result.status === "success" || result.failureCode !== "BROWSER_KNOWN_GPT_RATE_LIMIT") return null;
    try {
      this.providerRateLimitControl.assertProviderSubmitAllowed();
    } catch (gateError) {
      if (failureCode(gateError) === "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE") return null;
      return gateError;
    }
    let closureError: unknown = executionFailure(
      "failed", "PROVIDER_RATE_LIMIT_CLOSURE_DID_NOT_TERMINATE",
    );
    try {
      await closeKnownProviderRateLimit({
        execution, call, result,
        providerRateLimitControl: this.providerRateLimitControl,
        executeAcknowledgement: (acknowledgement, dispatchNotAfter) => this.executeOne(
          execution, browsers, acknowledgement, { rateLimitAckDispatchNotAfter: dispatchNotAfter },
        ),
      });
    } catch (caught) {
      closureError = caught;
    }
    try {
      this.providerRateLimitControl.assertProviderSubmitAllowed();
    } catch (gateError) {
      if (failureCode(gateError) === "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE") return null;
    }
    return closureError;
  }

  private async executeOne<K extends GptChildCapabilityId>(execution: ExecutionInput,
    browsers: ProductionGptBrowserLifecycle,
    call: ProductGptCallInput<K> & Readonly<{ sessionKey: string }>,
    {
      priorEffectKnown = false,
      rateLimitAckDispatchNotAfter, browserAtomicIdentity, recordConfirmedProviderEffectReadback,
    }: ExecuteOneOptions = {},
  ): Promise<ProductGptChildResult<K>> {
    const intent = this.intentFor(execution, call), contract = GPT_CHILD_CAPABILITY_CONTRACTS[call.child];
    const startedAt = new Date().toISOString();
    const span = this.childSpan(execution, intent);
    let result: GptChildCapabilityResult | undefined;
    let evidenceRef: string;
    let evidenceHash: GptHash;
    let artifactRefs: readonly string[] = Object.freeze([]);
    let browserCall: Awaited<ReturnType<ProductionGptBrowserLifecycle["browserFor"]>> | undefined;
    try {
      browserCall = await acquireProductionBrowserCall(browsers, call,
        contract.requiredTargetKind, priorEffectKnown);
      const recovered = await recoverPersistedTextCheckpoint({ evidenceStore: this.evidenceStore,
        execution, intent, call, browsers, browserCall, span });
      if (recovered) return recovered;
      if (!priorEffectKnown) this.assertProviderTurnBudget(execution, call);
      result = await runProductionAtomicPhase({ dataDir: this.dataDir, gpt: this.gpt,
        browsers, intent: intent as GptAnyChildCapabilityIntent, browserCall, signal: execution.abortSignal,
        resultRevision: execution.resultRevision, childCapabilityId: call.child,
        ...(browserAtomicIdentity ? { browserAtomicIdentity } : {}),
        ...(recordConfirmedProviderEffectReadback ? { recordConfirmedProviderEffectReadback } : {}),
        assertProviderInputAllowed: () => this.providerRateLimitControl.assertProviderSubmitAllowed(),
        ...(rateLimitAckDispatchNotAfter === undefined ? {} : { rateLimitAckDispatchNotAfter }) });
      if (call.child !== "acknowledge_known_gpt_rate_limit") {
        const closureError = await this.closeKnownRateLimitAndReadGate(execution, browsers, call, result);
        if (closureError) return terminalizeGptChildError(
          span, closureError, browserCall?.confirmedProviderEffect ?? null);
      }
      ({ evidenceRef, evidenceHash, artifactRefs } = await persistGptChildOutcome({
        call, result, intent: intent as GptAnyChildCapabilityIntent,
        execution, browsers, browserCall, evidenceStore: this.evidenceStore,
        ...(browserAtomicIdentity ? { browserAtomicIdentity } : {}),
      }));
    } catch (error) {
      result = await handleGptChildExecutionError({ dataDir: this.dataDir, execution,
        intent: intent as GptAnyChildCapabilityIntent, startedAt, error,
        browserCall, browserAtomicIdentity, span, childCapabilityId: call.child,
        closeKnownRateLimit: (failed) => this.closeKnownRateLimitAndReadGate(
          execution, browsers, call, failed),
      });
      evidenceRef = result.proof.browserFact?.evidenceRef ?? result.proof.evidenceRef;
      evidenceHash = result.proof.evidenceHash;
    }
    if (!result) return terminalizeGptChildError(
      span, executionFailure("failed", "GPT_CHILD_RESULT_MISSING"), undefined,
    );
    const terminalEventId = terminalizeGptChildResult(span, result);
    if (result.status !== "success") {
      throwGptChildFailure(
        result, evidenceRef, terminalEventId,
        result.failureCode === "BROWSER_GPT_DIALOG_UNRECOGNIZED"
          ? null : browserCall?.confirmedProviderEffect ?? null,
      );
    }
    const successful = result as Extract<GptChildCapabilityResult, { status: "success" }>;
    recordSettledProviderResult(call, successful.value, browsers, browserCall);
    return productChildResult({ execution, intent, value: successful.value,
      browserFact: successful.proof.browserFact, evidenceRef, evidenceHash, artifactRefs });
  }

}

export const createProductionGptChildTools = (
  ...input: ConstructorParameters<typeof ProductionGptChildTools>
): ProductionGptChildTools => new ProductionGptChildTools(...input);
