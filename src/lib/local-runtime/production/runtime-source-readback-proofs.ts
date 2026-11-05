import { hashCanonical } from "./contracts.js";
import type { RuntimeState } from "./runtime-state.js";
import type { SourceReadbackCallProof, SourceReadbackEffectProof } from "./source-readback-contract.js";
import type { ControlIntent } from "./transport-protocol.js";

type BrowserHistory = ReturnType<RuntimeState["browserAuthority"]["readJobBrowserHistoryEvidence"]>;
type BrowserEffect = BrowserHistory["replayEffects"][number];
type BrowserCall = BrowserHistory["replayCalls"][number];
type Observations = ReturnType<RuntimeState["store"]["readSourceReadbackObservations"]>;
type SettledHistory = ReturnType<RuntimeState["store"]["readAcceptedSourceSettlements"]>;
const identity = (effect: BrowserEffect) => ({
  effect_identity_hash: effect.effectIdentityHash,
  source_effect_set_hash: effect.sourceEffectSetHash,
  wal_authority_hash: effect.walAuthorityHash,
  anchor_state: effect.anchorState,
  anchor_proof_hash: effect.anchorProofHash,
});
const confirmed = (effect: BrowserEffect): boolean =>
  effect.state === "CONFIRMED" && effect.mutationOutcome === "confirmed"
  && effect.physicalInputCount === 1;
const checkpointBody = (effect: BrowserEffect, checkpoint: NonNullable<
  SourceReadbackEffectProof["settled_checkpoint"]>) => ({
  kind: "settled_checkpoint" as const, path: "source_checkpoint" as const,
  effect_identity_hash: effect.effectIdentityHash,
  source_effect_set_hash: effect.sourceEffectSetHash,
  wal_authority_hash: effect.walAuthorityHash, provider_input_delta: 0 as const,
  source_attempt_id: checkpoint.source_attempt_id,
  source_result_revision: checkpoint.source_result_revision,
  checkpoint_exact_call_identity_hash: checkpoint.checkpoint_exact_call_identity_hash,
  artifact_ref: checkpoint.artifact_ref,
  artifact_content_hash: checkpoint.artifact_content_hash,
  submit_prompt_hash: checkpoint.submit_prompt_hash,
  canonical_conversation_hash: checkpoint.canonical_conversation_hash,
  user_turn_hash: checkpoint.user_turn_hash,
});

type Checkpoint = NonNullable<SourceReadbackEffectProof["settled_checkpoint"]>;
type Settlement<K extends SettledHistory[number]["kind"]> = Extract<SettledHistory[number], { kind: K }>;

const checkpointProof = (
  checkpoint: Pick<Checkpoint, "source_attempt_id" | "source_result_revision"
    | "checkpoint_exact_call_identity_hash" | "artifact_ref" | "artifact_content_hash"
    | "submit_prompt_hash" | "canonical_conversation_hash" | "user_turn_hash">,
  proofHash: `sha256:${string}`, observedAt: string,
) => Object.freeze({
  source_attempt_id: checkpoint.source_attempt_id,
  source_result_revision: checkpoint.source_result_revision,
  checkpoint_exact_call_identity_hash: checkpoint.checkpoint_exact_call_identity_hash,
  artifact_ref: checkpoint.artifact_ref, artifact_content_hash: checkpoint.artifact_content_hash,
  submit_prompt_hash: checkpoint.submit_prompt_hash,
  canonical_conversation_hash: checkpoint.canonical_conversation_hash,
  user_turn_hash: checkpoint.user_turn_hash, proof_hash: proofHash,
  observed_at: observedAt, provider_input_delta: 0 as const,
});

const reusedCheckpointProof = (effect: BrowserEffect,
  item: Settlement<"reused_checkpoint">): SourceReadbackEffectProof | null => {
  const old = item.effect;
  const checkpoint = old.settled_checkpoint;
  if (!confirmed(effect) || effect.anchorState !== "trusted" || !checkpoint
    || old.effect_identity_hash !== effect.effectIdentityHash
    || old.source_effect_set_hash !== effect.sourceEffectSetHash
    || old.wal_authority_hash !== effect.walAuthorityHash
    || old.anchor_proof_hash !== effect.anchorProofHash
    || checkpoint.source_attempt_id !== effect.attemptId
    || checkpoint.source_result_revision !== effect.resultRevision
    || checkpoint.canonical_conversation_hash !== effect.canonicalConversationHash
    || checkpoint.user_turn_hash !== effect.userTurnHash) return null;
  return Object.freeze({ ...identity(effect), settled_checkpoint: checkpointProof(
    checkpoint, hashCanonical(checkpointBody(effect, checkpoint)), checkpoint.observed_at) });
};

const rejectionSettledProof = (effect: BrowserEffect,
  item: Settlement<"rejection_settled">): SourceReadbackEffectProof | null => {
  if (!confirmed(effect) || effect.authorityRef !== item.evidenceRef
    || effect.rawWalAuthorityHash !== item.evidenceHash) return null;
  return Object.freeze({ ...identity(effect), rejection_settled: Object.freeze({
    source_attempt_id: effect.attemptId,
    source_handoff_seal_hash: item.sourceHandoffSealHash,
  }) });
};

const riskAuthorizedProof = (effect: BrowserEffect,
  item: Settlement<"risk_authorized">): SourceReadbackEffectProof | null => {
  if (effect.anchorState !== item.sourceAnchorState
    || item.sourceWalAuthorityHash !== effect.walAuthorityHash
    || item.sourceAnchorProofHash !== effect.anchorProofHash) return null;
  return Object.freeze({ ...identity(effect), risk_authorized: Object.freeze({
    source_handoff_seal_hash: item.sourceHandoffSealHash,
  }) });
};

const acceptedProof = (effect: BrowserEffect, call: BrowserCall,
  history: SettledHistory): SourceReadbackEffectProof | null | undefined => {
  const matching = history.filter((item) => item.effectIdentityHash === effect.effectIdentityHash
    && item.sourceEffectSetHash === effect.sourceEffectSetHash
    && item.productStepId === call.productStepId && item.callId === call.callId
    && item.childCapabilityId === call.childCapabilityId
    && (item.kind === "risk_authorized" || item.sourceAttemptId === effect.attemptId));
  const item = matching[0];
  if (!item) return undefined;
  if (matching.length > 1 && (item.kind !== "reused_checkpoint"
    || matching.some((other) => other.kind !== "reused_checkpoint"
      || hashCanonical(other.effect) !== hashCanonical(item.effect)))) return null;
  if (item.kind === "reused_checkpoint") return reusedCheckpointProof(effect, item);
  if (item.kind === "rejection_settled") return rejectionSettledProof(effect, item);
  return riskAuthorizedProof(effect, item) ?? undefined;
};

const observedCheckpoint = (effect: BrowserEffect, observations: Observations):
  SourceReadbackEffectProof | null | undefined => {
  const settled = observations.find((item) => item.kind === "settled_checkpoint"
    && item.source_attempt_id === effect.attemptId
    && item.source_result_revision === effect.resultRevision);
  if (!settled || settled.kind !== "settled_checkpoint") return undefined;
  const { proof_hash: proofHash, observed_at: observedAt, ...body } = settled;
  if (!confirmed(effect) || effect.anchorState !== "trusted"
    || effect.canonicalConversationHash !== settled.canonical_conversation_hash
    || effect.userTurnHash !== settled.user_turn_hash
    || hashCanonical(body) !== proofHash) return null;
  return Object.freeze({ ...identity(effect),
    settled_checkpoint: checkpointProof(settled, proofHash, observedAt) });
};

const exhaustedProof = (effect: BrowserEffect, observations: Observations):
  SourceReadbackEffectProof | null => {
  if (effect.anchorState === "absent") {
    const observedAt = new Date().toISOString();
    return Object.freeze({ ...identity(effect), unaddressable: Object.freeze({
      proof_hash: hashCanonical({ effect_identity_hash: effect.effectIdentityHash,
        source_effect_set_hash: effect.sourceEffectSetHash,
        wal_authority_hash: effect.walAuthorityHash, anchor_state: "absent",
        anchor_proof_hash: effect.anchorProofHash, observed_at: observedAt,
        provider_input_delta: 0 }), observed_at: observedAt, provider_input_delta: 0 as const,
    }) });
  }
  const exact = observations.find((item) => item.kind === "negative_exact"
    && item.path === "exact_conversation"
    && item.canonical_conversation_hash === effect.canonicalConversationHash
    && item.user_turn_hash === effect.userTurnHash);
  if (!exact || exact.kind !== "negative_exact") return null;
  const proof = {
    effect_identity_hash: effect.effectIdentityHash,
    source_effect_set_hash: effect.sourceEffectSetHash,
    wal_authority_hash: effect.walAuthorityHash,
    canonical_conversation_hash: exact.canonical_conversation_hash,
    user_turn_hash: exact.user_turn_hash, pending_cause: exact.pending_cause,
    first_observed_at: exact.first_observed_at, observed_at: exact.observed_at,
    observation_count: exact.observation_count, provider_input_delta: 0 as const,
  };
  return Object.freeze({ ...identity(effect), exact_negative: Object.freeze({
    proof_hash: hashCanonical(proof), first_observed_at: exact.first_observed_at,
    observed_at: exact.observed_at, observation_count: exact.observation_count,
    pending_cause: exact.pending_cause,
    canonical_conversation_hash: exact.canonical_conversation_hash,
    user_turn_hash: exact.user_turn_hash, provider_input_delta: 0 as const,
  }) });
};
const effectReadbackProof = (effect: BrowserEffect, call: BrowserCall, observations: Observations,
  settledHistory: SettledHistory, unresolvedObservedAt: string | null): SourceReadbackEffectProof | null => {
  const accepted = acceptedProof(effect, call, settledHistory);
  if (accepted === null) return null;
  const matched = observations.filter(item => item.effect_identity_hash === effect.effectIdentityHash
    && item.source_effect_set_hash === effect.sourceEffectSetHash
    && item.wal_authority_hash === effect.walAuthorityHash && item.provider_input_delta === 0);
  const checkpoint = accepted === undefined ? observedCheckpoint(effect, matched) : undefined;
  if (checkpoint === null) return null;
  return accepted ?? checkpoint ?? exhaustedProof(effect, matched)
    ?? (unresolvedObservedAt ? Object.freeze({ ...identity(effect), unresolved: Object.freeze({
      source_attempt_id: effect.attemptId, source_result_revision: effect.resultRevision,
      wal_state: effect.state, mutation_outcome: effect.mutationOutcome,
      physical_input_count: effect.physicalInputCount, observed_at: unresolvedObservedAt, provider_input_delta: 0 as const,
    }) }) : null);
};

export const sourceReadbackProofs = (browser: BrowserHistory,
  observations: Observations, settledHistory: SettledHistory, retirementControl?: ControlIntent):
  readonly SourceReadbackCallProof[] | null => {
  if (!browser.walHistoryVerified || browser.replayCalls.length === 0) return null;
  const retirement = retirementControl?.intent === "cancel_requested"
    && retirementControl.reason_code === "ADMIN_AI_WORK_ORDER_REPLACEMENT" && retirementControl.control_epoch > 0;
  const observedAt = new Date().toISOString();
  const calls: SourceReadbackCallProof[] = [];
  for (const call of browser.replayCalls) {
    const effects = browser.replayEffects.filter(effect => effect.productStepId === call.productStepId
      && effect.callId === call.callId && effect.childCapabilityId === call.childCapabilityId);
    if (effects.length === 0) return null;
    const proofs: SourceReadbackEffectProof[] = [];
    for (const effect of effects) {
      const proof = effectReadbackProof(effect, call, observations, settledHistory, retirement ? observedAt : null);
      if (!proof) return null;
      proofs.push(proof);
    }
    calls.push(Object.freeze({
      product_step_id: call.productStepId, call_id: call.callId,
      child_capability_id: call.childCapabilityId, source_effect_set_hash: call.sourceEffectSetHash,
      disposition: proofs.some(effect => effect.unresolved !== undefined) ? "unresolved" as const
        : proofs.some(effect => effect.settled_checkpoint !== undefined) ? "settled_reusable" as const
        : proofs.some(effect => effect.exact_negative !== undefined || effect.unaddressable !== undefined)
          ? "replay_exhausted" as const : "historical_settled" as const,
      effects: Object.freeze(proofs),
    }));
  }
  return Object.freeze(calls);
};

export const historicalEffectsSettled = (
  effects: readonly (Pick<BrowserEffect, "attemptId" | "effectIdentityHash"
    | "sourceEffectSetHash" | "productStepId" | "callId"
    | "childCapabilityId" | "authorityRef" | "walAuthorityHash"
    | "rawWalAuthorityHash" | "anchorProofHash" | "anchorState">)[],
  settledHistory: SettledHistory, currentAttemptId: string,
): boolean => effects.length > 0 && effects.every((effect) =>
  effect.attemptId !== currentAttemptId
  && settledHistory.some((item) => item.effectIdentityHash === effect.effectIdentityHash
    && item.sourceEffectSetHash === effect.sourceEffectSetHash
    && item.productStepId === effect.productStepId && item.callId === effect.callId
    && item.childCapabilityId === effect.childCapabilityId
    && (item.kind === "risk_authorized"
      ? item.sourceAnchorState === effect.anchorState
        && item.sourceWalAuthorityHash === effect.walAuthorityHash
        && item.sourceAnchorProofHash === effect.anchorProofHash
      : item.kind === "reused_checkpoint"
        ? item.sourceAttemptId === effect.attemptId
          && item.effect.wal_authority_hash === effect.walAuthorityHash
          && item.effect.anchor_proof_hash === effect.anchorProofHash
        : item.sourceAttemptId === effect.attemptId
          && item.evidenceRef === effect.authorityRef
          && item.evidenceHash === effect.rawWalAuthorityHash)));
