import { hashCanonical } from "./contracts.js";
import type { RuntimeState } from "./runtime-state.js";
import type { SourceReadbackCallProof, SourceReadbackEffectProof } from "./source-readback-contract.js";

type BrowserHistory = ReturnType<RuntimeState["browserAuthority"]["readJobBrowserHistoryEvidence"]>;
type BrowserEffect = BrowserHistory["replayEffects"][number];
type BrowserCall = BrowserHistory["replayCalls"][number];
type Observations = ReturnType<RuntimeState["store"]["readSourceReadbackObservations"]>;
type SettledHistory = ReturnType<RuntimeState["store"]["readAcceptedSourceSettlements"]>;

const effectIdentity = (effect: BrowserEffect) => ({
  effect_identity_hash: effect.effectIdentityHash,
  source_effect_set_hash: effect.sourceEffectSetHash,
  old_target_ref_hash: effect.oldTargetRefHash,
  old_document_ref_hash: effect.oldDocumentRefHash,
  wal_authority_hash: effect.walAuthorityHash,
  anchor_state: effect.anchorState,
  anchor_proof_hash: effect.anchorProofHash,
});

const confirmedReplayEffect = (effect: BrowserEffect): boolean =>
  effect.state === "CONFIRMED" && effect.mutationOutcome === "confirmed"
  && effect.physicalInputCount === 1;

// Undefined means no accepted settlement; null means a contradictory settlement.
const acceptedEffectProof = (
  effect: BrowserEffect, call: BrowserCall, history: SettledHistory,
): SourceReadbackEffectProof | null | undefined => {
  const matching = history.filter((item) => item.effectIdentityHash === effect.effectIdentityHash
    && item.sourceEffectSetHash === effect.sourceEffectSetHash
    && item.productStepId === call.productStepId && item.callId === call.callId
    && item.childCapabilityId === call.childCapabilityId
    && (item.kind === "risk_authorized" || item.sourceAttemptId === effect.attemptId));
  const rejection = matching.find((item): item is Extract<SettledHistory[number],
    { kind: "rejection_settled" }> => item.kind === "rejection_settled");
  const risk = matching.find((item) => item.kind === "risk_authorized");
  const reused = matching.find((item): item is Extract<SettledHistory[number],
    { kind: "reused_checkpoint" }> => item.kind === "reused_checkpoint");
  if ([rejection, risk, reused].filter(Boolean).length > 1) return null;
  if (reused) {
    if (!confirmedReplayEffect(effect) || effect.anchorState !== "trusted"
      || reused.effect.wal_authority_hash !== effect.walAuthorityHash
      || reused.effect.old_target_ref_hash !== effect.oldTargetRefHash
      || reused.effect.old_document_ref_hash !== effect.oldDocumentRefHash
      || reused.effect.anchor_proof_hash !== effect.anchorProofHash) return null;
    return reused.effect;
  }
  if (rejection) {
    if (!confirmedReplayEffect(effect) || effect.authorityRef !== rejection.evidenceRef
      || effect.walAuthorityHash !== rejection.evidenceHash) return null;
    return Object.freeze({ ...effectIdentity(effect), old_path: null, exact_path: null,
      rejection_settled: Object.freeze({ source_attempt_id: effect.attemptId,
        source_handoff_seal_hash: rejection.sourceHandoffSealHash }) });
  }
  if (risk) return Object.freeze({ ...effectIdentity(effect), old_path: null, exact_path: null,
    risk_authorized: Object.freeze({ source_handoff_seal_hash: risk.sourceHandoffSealHash }) });
  return undefined;
};

const checkpointProof = (
  effect: BrowserEffect, observations: Observations,
): SourceReadbackEffectProof | null | undefined => {
  const settled = observations.find((item): item is Extract<Observations[number],
    { kind: "settled_checkpoint" }> => item.kind === "settled_checkpoint"
    && item.source_attempt_id === effect.attemptId
    && item.source_result_revision === effect.resultRevision);
  if (!settled) return undefined;
  const { proof_hash: proofHash, observed_at: observedAt, ...settledBody } = settled;
  if (effect.state !== "CONFIRMED" || effect.mutationOutcome !== "confirmed"
    || effect.physicalInputCount !== 1 || effect.anchorState !== "trusted"
    || effect.canonicalConversationHash !== settled.canonical_conversation_hash
    || effect.userTurnHash !== settled.user_turn_hash
    || hashCanonical(settledBody) !== proofHash) return null;
  return Object.freeze({ ...effectIdentity(effect), old_path: null, exact_path: null,
    settled_checkpoint: Object.freeze({
      source_attempt_id: settled.source_attempt_id,
      source_result_revision: settled.source_result_revision,
      checkpoint_exact_call_identity_hash: settled.checkpoint_exact_call_identity_hash,
      artifact_ref: settled.artifact_ref,
      artifact_content_hash: settled.artifact_content_hash,
      submit_prompt_hash: settled.submit_prompt_hash,
      canonical_conversation_hash: settled.canonical_conversation_hash,
      user_turn_hash: settled.user_turn_hash,
      proof_hash: proofHash, observed_at: observedAt, provider_input_delta: 0,
    }) });
};

const negativePathsProof = (
  effect: BrowserEffect, observations: Observations, browser: BrowserHistory,
): SourceReadbackEffectProof | null => {
  const old = observations.find((item): item is Extract<Observations[number], { kind: "negative_exact" }> =>
    item.kind === "negative_exact" && item.path === "old_target"
    && item.target_ref_hash === effect.oldTargetRefHash);
  const unavailable = observations.find((item): item is Extract<Observations[number], { kind: "old_instance_unavailable" }> =>
    item.kind === "old_instance_unavailable" && item.path === "old_target");
  const settlement = browser.targetSettlements.find((item) =>
    item.targetRefHash === effect.oldTargetRefHash);
  const exact = observations.find((item): item is Extract<Observations[number], { kind: "negative_exact" }> =>
    item.kind === "negative_exact" && item.path === "exact_conversation"
    && item.target_ref_hash !== effect.oldTargetRefHash);
  const unaddressable = effect.anchorState === "absent" && settlement !== undefined;
  if (!old && !unavailable && !unaddressable
    || effect.anchorState === "trusted" && !exact) return null;
  const oldPath = old ? Object.freeze({ outcome: "negative_observed" as const,
    proof_hash: old.observation_revision_hash, observed_at: old.observed_at,
    provider_input_delta: 0 as const,
    target_ref_hash: old.target_ref_hash, document_ref_hash: old.document_ref_hash,
  }) : unavailable ? Object.freeze({ outcome: "instance_unavailable" as const,
    proof_hash: unavailable.proof_hash, observed_at: unavailable.observed_at,
    provider_input_delta: 0 as const, target_ref_hash: effect.oldTargetRefHash,
    document_ref_hash: effect.oldDocumentRefHash,
  }) : Object.freeze({ outcome: "unaddressable_quiesced" as const,
    proof_hash: hashCanonical({ effectIdentityHash: effect.effectIdentityHash,
      anchorProofHash: effect.anchorProofHash, settlementProofHash: settlement!.proofHash }),
    settlement_proof_hash: settlement!.proofHash, settlement_outcome: settlement!.outcome,
    observed_at: settlement!.releasedAt, provider_input_delta: 0 as const,
    target_ref_hash: effect.oldTargetRefHash, document_ref_hash: effect.oldDocumentRefHash,
  });
  return Object.freeze({ ...effectIdentity(effect), old_path: oldPath,
    exact_path: effect.anchorState === "trusted" && exact ? Object.freeze({
      outcome: "negative_observed" as const, proof_hash: exact.observation_revision_hash,
      target_ref_hash: exact.target_ref_hash, document_ref_hash: exact.document_ref_hash,
      observed_at: exact.observed_at, provider_input_delta: 0 as const,
    }) : null });
};

export const sourceReadbackProofs = (
  browser: BrowserHistory, observations: Observations, settledHistory: SettledHistory,
): readonly SourceReadbackCallProof[] | null => {
  if (!browser.walHistoryVerified || browser.replayCalls.length === 0) return null;
  const calls: SourceReadbackCallProof[] = [];
  for (const call of browser.replayCalls) {
    const effects = browser.replayEffects.filter((effect) => effect.productStepId === call.productStepId
      && effect.callId === call.callId && effect.childCapabilityId === call.childCapabilityId);
    if (effects.length === 0) return null;
    const effectProofs: SourceReadbackEffectProof[] = [];
    for (const effect of effects) {
      const accepted = acceptedEffectProof(effect, call, settledHistory);
      if (accepted === null) return null;
      const matchingObservations = observations.filter((item) =>
        item.effect_identity_hash === effect.effectIdentityHash
        && item.source_effect_set_hash === effect.sourceEffectSetHash
        && item.old_target_ref_hash === effect.oldTargetRefHash
        && item.old_document_ref_hash === effect.oldDocumentRefHash
        && item.wal_authority_hash === effect.walAuthorityHash
        && item.provider_input_delta === 0);
      const checkpoint = accepted === undefined ? checkpointProof(effect, matchingObservations) : undefined;
      if (checkpoint === null) return null;
      const proof = accepted ?? checkpoint ?? negativePathsProof(effect, matchingObservations, browser);
      if (!proof) return null;
      effectProofs.push(proof);
    }
    calls.push(Object.freeze({
      product_step_id: call.productStepId, call_id: call.callId,
      child_capability_id: call.childCapabilityId,
      source_effect_set_hash: call.sourceEffectSetHash,
      disposition: effectProofs.some((effect) => effect.settled_checkpoint !== undefined)
        ? "settled_reusable" as const
        : effectProofs.some((effect) => effect.old_path !== null)
          ? "replay_exhausted" as const : "historical_settled" as const,
      effects: Object.freeze(effectProofs),
    }));
  }
  return Object.freeze(calls);
};

export const historicalEffectsSettled = (
  effects: readonly Pick<ReturnType<RuntimeState["browserAuthority"]["readJobBrowserHistoryEvidence"]>["replayEffects"][number],
    "attemptId" | "effectIdentityHash" | "sourceEffectSetHash" | "productStepId" | "callId"
    | "childCapabilityId" | "authorityRef" | "walAuthorityHash">[],
  settledHistory: ReturnType<RuntimeState["store"]["readAcceptedSourceSettlements"]>,
  currentAttemptId: string,
): boolean => effects.length > 0 && effects.every((effect) =>
  effect.attemptId !== currentAttemptId
  && settledHistory.some((item) => item.effectIdentityHash === effect.effectIdentityHash
    && item.sourceEffectSetHash === effect.sourceEffectSetHash
    && item.productStepId === effect.productStepId
    && item.callId === effect.callId
    && item.childCapabilityId === effect.childCapabilityId
    && (item.kind === "risk_authorized" ? true
      : item.kind === "reused_checkpoint"
        ? item.sourceAttemptId === effect.attemptId
          && item.effect.wal_authority_hash === effect.walAuthorityHash
        : item.sourceAttemptId === effect.attemptId
          && item.evidenceRef === effect.authorityRef
          && item.evidenceHash === effect.walAuthorityHash)));
