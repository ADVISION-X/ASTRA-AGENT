import { executionFailure } from "../../execution-failure.js";
import { hashCanonical, sha256 } from "./contracts.js";
import { isAttemptFailureFirstFact } from "./store-foundation.js";
import type { SourceAttemptHandoff, SourceReadbackCallProof,
  SourceReadbackEffectProof, SourceReadbackObservation } from "./source-readback-contract.js";

const validHash = (value: string): boolean => /^sha256:[a-f0-9]{64}$/u.test(value);

const validObservationIdentity = (observation: SourceReadbackObservation): boolean =>
  [observation.effect_identity_hash, observation.source_effect_set_hash,
    observation.old_target_ref_hash, observation.old_document_ref_hash,
    observation.wal_authority_hash].every(validHash)
    && observation.provider_input_delta === 0
    && Number.isFinite(Date.parse(observation.observed_at));

const validCheckpointObservation = (
  observation: Extract<SourceReadbackObservation, { kind: "settled_checkpoint" }>,
): boolean => observation.path === "source_checkpoint" && Boolean(observation.source_attempt_id)
  && Number.isSafeInteger(observation.source_result_revision)
  && observation.source_result_revision >= 0 && Boolean(observation.artifact_ref)
  && [observation.artifact_content_hash, observation.checkpoint_exact_call_identity_hash,
    observation.submit_prompt_hash, observation.canonical_conversation_hash,
    observation.user_turn_hash, observation.proof_hash].every(validHash);

const validNegativeObservation = (
  observation: Extract<SourceReadbackObservation, { kind: "negative_exact" }>,
): boolean => (observation.path === "old_target" || observation.path === "exact_conversation")
  && Number.isSafeInteger(observation.observation_count)
  && observation.observation_count >= 2
  && Number.isFinite(Date.parse(observation.first_observed_at))
  && Date.parse(observation.observed_at) > Date.parse(observation.first_observed_at)
  && [observation.target_ref_hash, observation.document_ref_hash,
    observation.observation_revision_hash, observation.canonical_conversation_hash,
    observation.user_turn_hash].every(validHash)
  && (observation.pending_cause === "exact-user-turn-unavailable"
    || observation.pending_cause === "adjacent-assistant-missing");

export const validSourceReadbackObservation = (observation: SourceReadbackObservation): boolean => {
  if (!validObservationIdentity(observation)) return false;
  if (observation.kind === "settled_checkpoint") return validCheckpointObservation(observation);
  if (observation.kind === "negative_exact") return validNegativeObservation(observation);
  return observation.path === "old_target" && validHash(observation.proof_hash);
};

type Row = Readonly<{
  source_attempt_id: string; issued_attempt_id: string; seal_hash: `sha256:${string}`;
  source_manifest_json: string | null; first_fact_raw: string | null;
}>;
type Call = SourceAttemptHandoff["replay_calls"][number];
type Checkpoint = Extract<SourceReadbackEffectProof, { settled_checkpoint: object }>;
export type AcceptedSourceSettlement =
  | Readonly<{ kind: "rejection_settled"; sourceAttemptId: string;
    sourceHandoffSealHash: `sha256:${string}`; effectIdentityHash: `sha256:${string}`;
    evidenceRef: string; evidenceHash: `sha256:${string}`;
    sourceEffectSetHash: `sha256:${string}`;
    productStepId: string; callId: string; childCapabilityId: string }>
  | Readonly<{ kind: "risk_authorized";
    sourceHandoffSealHash: `sha256:${string}`; effectIdentityHash: `sha256:${string}`;
    sourceEffectSetHash: `sha256:${string}`;
    productStepId: string; callId: string; childCapabilityId: string }>
  | Readonly<{ kind: "reused_checkpoint"; sourceAttemptId: string;
    sourceHandoffSealHash: `sha256:${string}`; effect: Checkpoint;
    effectIdentityHash: `sha256:${string}`; sourceEffectSetHash: `sha256:${string}`;
    productStepId: string; callId: string; childCapabilityId: string }>;

const matchingCall = (manifest: SourceAttemptHandoff, proof: SourceReadbackCallProof): Call | undefined =>
  manifest.replay_calls.find((call) => call.product_step_id === proof.product_step_id
    && call.call_id === proof.call_id && call.child_capability_id === proof.child_capability_id
    && call.source_effect_set_hash === proof.source_effect_set_hash);

const reusableSettlements = (row: Row, manifest: SourceAttemptHandoff): AcceptedSourceSettlement[] => {
  if (!manifest.payload_slot_conflict || manifest.replay_calls.length === 0
    || manifest.readback_proofs.length !== manifest.replay_calls.length
    || manifest.readback_proofs.some((proof) => proof.disposition !== "settled_reusable")) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
  }
  const settled: AcceptedSourceSettlement[] = [];
  for (const proof of manifest.readback_proofs) {
    const call = matchingCall(manifest, proof);
    const checkpoints = proof.effects.filter((effect): effect is Checkpoint =>
      effect.settled_checkpoint !== undefined);
    if (!call || checkpoints.length !== proof.effects.length || checkpoints.length === 0) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
    }
    for (const effect of checkpoints) {
      if (effect.source_effect_set_hash !== call.source_effect_set_hash) {
        throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
      }
      settled.push(Object.freeze({ kind: "reused_checkpoint", sourceAttemptId:
        effect.settled_checkpoint.source_attempt_id, sourceHandoffSealHash: row.seal_hash,
        effect, effectIdentityHash: effect.effect_identity_hash,
        sourceEffectSetHash: effect.source_effect_set_hash,
        productStepId: proof.product_step_id, callId: proof.call_id,
        childCapabilityId: proof.child_capability_id }));
    }
  }
  return settled;
};

const riskSettlements = (
  row: Row, manifest: SourceAttemptHandoff, exhausted: readonly SourceReadbackCallProof[],
): AcceptedSourceSettlement[] => {
  const settled: AcceptedSourceSettlement[] = [];
  for (const proof of exhausted) {
    if (!matchingCall(manifest, proof)) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
    }
    let exhaustedEffects = 0;
    for (const effect of proof.effects) {
      if (effect.old_path === null) {
        if (!("rejection_settled" in effect) && !("risk_authorized" in effect)
          && !("settled_checkpoint" in effect)) {
          throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
        }
        continue;
      }
      exhaustedEffects += 1;
      settled.push(Object.freeze({ kind: "risk_authorized", sourceHandoffSealHash: row.seal_hash,
        effectIdentityHash: effect.effect_identity_hash,
        sourceEffectSetHash: effect.source_effect_set_hash,
        productStepId: proof.product_step_id, callId: proof.call_id,
        childCapabilityId: proof.child_capability_id }));
    }
    if (exhaustedEffects === 0) throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
  }
  return settled;
};

const replaySettlements = (row: Row, manifest: SourceAttemptHandoff): AcceptedSourceSettlement[] => {
  const exhausted = manifest.readback_proofs.filter((proof) =>
    proof.disposition === "replay_exhausted");
  if (manifest.readback_exhaustion_hash !== hashCanonical(exhausted)) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
  }
  return exhausted.length === 0
    ? reusableSettlements(row, manifest) : riskSettlements(row, manifest, exhausted);
};

const settledRejectionFirstFact = (
  row: Row, manifest: SourceAttemptHandoff,
): Readonly<{ effectIdentityHash: `sha256:${string}`;
  evidenceRef: string; evidenceHash: `sha256:${string}` }> => {
  const raw = row.first_fact_raw;
  const first = raw === null ? null : JSON.parse(raw) as unknown;
  if (!first || !isAttemptFailureFirstFact(first)
    || manifest.first_fact_raw_hash !== sha256(Buffer.from(raw!, "utf8"))
    || first.failure_core.code !== "RESULT_SETTLED_UNUSABLE"
      && first.failure_core.code !== "GPT_RESPONSE_STOPPED_EMPTY"
    || first.failure_core.effect_scope !== "provider_effect"
    || first.failure_core.browser_outcome !== "CONFIRMED"
    || first.failure_core.mutation_outcome !== "confirmed"
    || first.failure_core.provider_effect_identity_hash === null
    || first.failure_core.evidence_ref === null || first.failure_core.evidence_hash === null) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_REJECTION_INVALID");
  }
  return Object.freeze({ effectIdentityHash: first.failure_core.provider_effect_identity_hash,
    evidenceRef: first.failure_core.evidence_ref,
    evidenceHash: first.failure_core.evidence_hash });
};

const rejectionSettlement = (row: Row, manifest: SourceAttemptHandoff): AcceptedSourceSettlement => {
  const historical = !Object.hasOwn(manifest, "rejected_call");
  const rejectedCall = historical && manifest.replay_calls.length === 1
    && Array.isArray(manifest.readback_proofs) && manifest.readback_proofs.length === 0
    ? manifest.replay_calls[0] : manifest.rejected_call;
  const first = settledRejectionFirstFact(row, manifest);
  if (!rejectedCall || !manifest.replay_calls.some((call) =>
      call.product_step_id === rejectedCall.product_step_id
      && call.call_id === rejectedCall.call_id
      && call.child_capability_id === rejectedCall.child_capability_id
      && call.source_effect_set_hash === rejectedCall.source_effect_set_hash)
    || !historical && manifest.rejected_call?.effect_identity_hash
      !== first.effectIdentityHash) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_REJECTION_INVALID");
  }
  return Object.freeze({ kind: "rejection_settled", sourceAttemptId: row.source_attempt_id,
    sourceHandoffSealHash: row.seal_hash,
    effectIdentityHash: first.effectIdentityHash,
    evidenceRef: first.evidenceRef, evidenceHash: first.evidenceHash,
    sourceEffectSetHash: rejectedCall.source_effect_set_hash,
    productStepId: rejectedCall.product_step_id, callId: rejectedCall.call_id,
    childCapabilityId: rejectedCall.child_capability_id });
};

export const acceptedSourceSettlements = (
  rows: readonly Row[], currentAttempt: string, jobId: string,
): readonly AcceptedSourceSettlement[] => {
  const byIssued = new Map<string, Row>();
  for (const row of rows) {
    if (byIssued.has(row.issued_attempt_id)) throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
    byIssued.set(row.issued_attempt_id, row);
  }
  const settled: AcceptedSourceSettlement[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined = currentAttempt;
  while (cursor && byIssued.has(cursor)) {
    if (seen.has(cursor)) throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
    seen.add(cursor);
    const row: Row = byIssued.get(cursor)!;
    cursor = row.source_attempt_id;
    if (!row.source_manifest_json) throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
    const manifest = JSON.parse(row.source_manifest_json) as SourceAttemptHandoff;
    const { seal_hash: sealHash, ...body } = manifest;
    if (sealHash !== row.seal_hash || hashCanonical(body) !== sealHash
      || manifest.job_id !== jobId || manifest.source_attempt_id !== row.source_attempt_id) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
    }
    if (manifest.kind === "delivery_priority_replay") {
      settled.push(...replaySettlements(row, manifest));
      continue;
    }
    if (manifest.kind === "attempt_handoff" && manifest.browser_input_state === "possible") {
      settled.push(rejectionSettlement(row, manifest));
    }
  }
  return Object.freeze(settled);
};
