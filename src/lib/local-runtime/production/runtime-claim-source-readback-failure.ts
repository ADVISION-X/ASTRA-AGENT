import { executionFailure, executionFailureMetadata, exactReadbackNegativeObservation,
} from "../../execution-failure.js";
import { sha256 } from "./contracts.js";
import type { RuntimeState } from "./runtime-state.js";
import type { ClaimedProductionTask } from "./transport-protocol.js";

type BrowserEffect = ReturnType<RuntimeState["browserAuthority"]["readJobBrowserHistoryEvidence"]>["replayEffects"][number];

const exactEffect = (state: RuntimeState, jobId: string, effectId: `sha256:${string}`): BrowserEffect => {
  const history = state.browserAuthority.readJobBrowserHistoryEvidence(jobId);
  const effects = history.replayEffects.filter((item) => item.effectIdentityHash === effectId);
  if (effects.length !== 1) throw executionFailure("failed", "PRODUCTION_SOURCE_EFFECT_IDENTITY_AMBIGUOUS");
  return effects[0]!;
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
  state.store.recordSourceReadbackObservation(job.job_id, job.grant.attempt_id, {
    kind: "negative_exact", effect_identity_hash: effectId,
    source_effect_set_hash: effect.sourceEffectSetHash, path: "exact_conversation",
    wal_authority_hash: effect.walAuthorityHash,
    observation_revision_hash: negative.observationRevisionHash,
    observed_at: negative.observedAt, first_observed_at: negative.firstObservedAt,
    observation_count: negative.observationCount, pending_cause: negative.pendingCause,
    canonical_conversation_hash: conversationHash, user_turn_hash: userTurnHash,
    provider_input_delta: 0,
  });
};

export const reconcileSourceReadbackFailure = async (
  state: RuntimeState, job: ClaimedProductionTask, error: unknown, code: string,
): Promise<void> => {
  const negative = exactReadbackNegativeObservation(error);
  const effectId = executionFailureMetadata(error)?.browserEffect?.providerEffectIdentityHash;
  if (code === "GPT_EXACT_READBACK_UNAVAILABLE" && !effectId) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_EFFECT_IDENTITY_MISSING");
  }
  if (code === "GPT_EXACT_READBACK_UNAVAILABLE" && !negative) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_EXACT_READBACK_FACT_MISSING");
  }
  if (code === "GPT_EXACT_READBACK_UNAVAILABLE" && negative && effectId) {
    await recordNegativeExactReadback(state, job, negative, effectId);
  }
};
