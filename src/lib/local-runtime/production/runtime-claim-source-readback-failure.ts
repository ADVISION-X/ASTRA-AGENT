import { executionFailure, executionFailureMetadata, exactReadbackNegativeObservation,
  failureCode, oldTargetUnavailableFact } from "../../execution-failure.js";
import { sha256 } from "./contracts.js";
import { safeReason, type RuntimeState } from "./runtime-state.js";
import type { ClaimedProductionTask } from "./transport-protocol.js";

type BrowserEffect = ReturnType<RuntimeState["browserAuthority"]["readJobBrowserHistoryEvidence"]>["replayEffects"][number];

const exactEffect = (state: RuntimeState, jobId: string, effectId: `sha256:${string}`): BrowserEffect => {
  const history = state.browserAuthority.readJobBrowserHistoryEvidence(jobId);
  const effects = history.replayEffects.filter((item) => item.effectIdentityHash === effectId);
  if (effects.length !== 1) throw executionFailure("failed", "PRODUCTION_SOURCE_EFFECT_IDENTITY_AMBIGUOUS");
  return effects[0]!;
};

const recordOldInstanceUnavailable = async (
  state: RuntimeState, job: ClaimedProductionTask, error: unknown, effectId: `sha256:${string}`,
): Promise<void> => {
  const unavailableFact = oldTargetUnavailableFact(error);
  const effect = exactEffect(state, job.job_id, effectId);
  if (!unavailableFact
    || unavailableFact.jobRefHash !== sha256(Buffer.from(job.job_id, "utf8"))
    || unavailableFact.targetRefHash !== effect.oldTargetRefHash) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_OLD_INSTANCE_FACT_INVALID");
  }
  state.store.recordSourceReadbackObservation(job.job_id, job.grant.attempt_id, {
    kind: "old_instance_unavailable", path: "old_target",
    effect_identity_hash: effectId, source_effect_set_hash: effect.sourceEffectSetHash,
    old_target_ref_hash: effect.oldTargetRefHash,
    old_document_ref_hash: effect.oldDocumentRefHash,
    wal_authority_hash: effect.walAuthorityHash, observed_at: new Date().toISOString(),
    proof_hash: unavailableFact.proofHash, provider_input_delta: 0,
  });
  await state.browserAuthority.releaseJobBoundTarget(
    job.job_id, "wait-new-attempt", state.abort.signal,
  );
};

const recordNegativeExactReadback = async (
  state: RuntimeState, job: ClaimedProductionTask,
  negative: NonNullable<ReturnType<typeof exactReadbackNegativeObservation>>,
  effectId: `sha256:${string}`,
): Promise<void> => {
  const effect = exactEffect(state, job.job_id, effectId);
  const conversationHash = sha256(Buffer.from(negative.canonicalConversationUrl, "utf8"));
  const userTurnHash = sha256(Buffer.from(negative.userTurnId, "utf8"));
  if (effect.anchorState !== "trusted"
    || effect.canonicalConversationHash !== conversationHash
    || effect.userTurnHash !== userTurnHash) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_READBACK_ANCHOR_MISMATCH");
  }
  const readbackPath = negative.targetRefHash === effect.oldTargetRefHash
    ? "old_target" as const : "exact_conversation" as const;
  state.store.recordSourceReadbackObservation(job.job_id, job.grant.attempt_id, {
    kind: "negative_exact", effect_identity_hash: effectId,
    source_effect_set_hash: effect.sourceEffectSetHash, path: readbackPath,
    old_target_ref_hash: effect.oldTargetRefHash,
    old_document_ref_hash: effect.oldDocumentRefHash,
    target_ref_hash: negative.targetRefHash, document_ref_hash: negative.documentRefHash,
    wal_authority_hash: effect.walAuthorityHash,
    observation_revision_hash: negative.observationRevisionHash,
    observed_at: negative.observedAt, first_observed_at: negative.firstObservedAt,
    observation_count: negative.observationCount, pending_cause: negative.pendingCause,
    canonical_conversation_hash: conversationHash, user_turn_hash: userTurnHash,
    provider_input_delta: 0,
  });
  if (readbackPath === "old_target") {
    try { await state.browserAuthority.releaseJobBoundTarget(
      job.job_id, "wait-new-attempt", state.abort.signal,
    ); } catch (releaseError) {
      state.lastErrorCode = failureCode(releaseError, "SOURCE_TARGET_RELEASE_PENDING");
      state.lastErrorReason = safeReason(releaseError);
    }
  }
};

export const reconcileSourceReadbackFailure = async (
  state: RuntimeState, job: ClaimedProductionTask, error: unknown, code: string,
): Promise<void> => {
  const negative = exactReadbackNegativeObservation(error);
  const effectId = executionFailureMetadata(error)?.browserEffect?.providerEffectIdentityHash;
  if ((code === "BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE"
    || code === "GPT_EXACT_READBACK_UNAVAILABLE") && !effectId) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_EFFECT_IDENTITY_MISSING");
  }
  if (code === "BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE" && effectId) {
    await recordOldInstanceUnavailable(state, job, error, effectId);
  }
  if (code === "GPT_EXACT_READBACK_UNAVAILABLE" && !negative) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_EXACT_READBACK_FACT_MISSING");
  }
  if (code === "GPT_EXACT_READBACK_UNAVAILABLE" && negative && effectId) {
    await recordNegativeExactReadback(state, job, negative, effectId);
  }
};
