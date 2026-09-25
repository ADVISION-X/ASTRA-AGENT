import { executionFailure } from "../../execution-failure.js";
import { hashCanonical } from "./contracts.js";
import { isAttemptFailureFirstFact } from "./store-foundation.js";
import type { SourceAttemptHandoff, SourceReadbackCallProof,
  SourceReadbackEffectProof, SourceReadbackObservation } from "./source-readback-contract.js";

const validHash = (value: string): boolean => /^sha256:[a-f0-9]{64}$/u.test(value);

export const targetlessFirstFactHash = (raw: string | null): `sha256:${string}` | null => {
  if (raw === null) return null;
  const first: unknown = JSON.parse(raw);
  if (!isAttemptFailureFirstFact(first)) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_REJECTION_INVALID");
  }
  const fact = first.failure_core;
  return hashCanonical({ schema_version: "targetless-first-fact.v44",
    attempt_id: first.release_descriptor.attempt_id, code: fact.code,
    effect_scope: fact.effect_scope, child_capability_id: fact.child_capability_id,
    browser_outcome: fact.browser_outcome, mutation_outcome: fact.mutation_outcome,
    provider_effect_identity_hash: fact.provider_effect_identity_hash,
    settled_result_payload_hash: fact.settled_result_payload_hash });
};

const validObservationIdentity = (observation: SourceReadbackObservation): boolean =>
  [observation.effect_identity_hash, observation.source_effect_set_hash,
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
): boolean => observation.path === "exact_conversation"
  && Number.isSafeInteger(observation.observation_count)
  && observation.observation_count >= 2
  && Number.isFinite(Date.parse(observation.first_observed_at))
  && Date.parse(observation.observed_at) > Date.parse(observation.first_observed_at)
  && [observation.observation_revision_hash, observation.canonical_conversation_hash,
    observation.user_turn_hash].every(validHash)
  && (observation.pending_cause === "exact-user-turn-unavailable"
    || observation.pending_cause === "adjacent-assistant-missing");

export const validSourceReadbackObservation = (observation: SourceReadbackObservation): boolean => {
  if (!validObservationIdentity(observation)) return false;
  if (observation.kind === "settled_checkpoint") return validCheckpointObservation(observation);
  if (observation.kind === "negative_exact") return validNegativeObservation(observation);
  return false;
};

type Row = Readonly<{
  source_attempt_id: string; issued_attempt_id: string; seal_hash: `sha256:${string}`;
  source_manifest_json: string | null; first_fact_raw: string | null;
}>;
type Call = SourceAttemptHandoff["replay_calls"][number];
type Checkpoint = Extract<SourceReadbackEffectProof, { settled_checkpoint: object }>;
type SignedManifest = SourceAttemptHandoff;
type SignedCallProof = SourceReadbackCallProof;
const v44HandoffKeys = "browser_history_hash|browser_input_state|browser_row_count|first_fact_raw_hash|input_quiescence_proof|job_id|kind|outbox_candidate_count|outbox_history_hash|payload_slot_conflict|readback_exhaustion_hash|readback_proofs|rejected_call|replay_calls|seal_hash|source_attempt_id|source_task_hash";
export const validV44SourceHandoff = (value: unknown): value is SourceAttemptHandoff => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const manifest = value as SourceAttemptHandoff;
  if (Object.keys(value).sort().join("|") !== v44HandoffKeys
    || !["attempt_handoff", "delivery_priority_replay"].includes(manifest.kind)
    || !["zero", "possible", "unknown"].includes(manifest.browser_input_state)
    || !Array.isArray(manifest.replay_calls) || !Array.isArray(manifest.readback_proofs)
    || manifest.replay_calls.some((call) => !call || Object.keys(call).sort().join("|")
      !== "call_id|child_capability_id|product_step_id|source_effect_set_hash")
    || manifest.readback_proofs.some((call) =>
      !call || Object.keys(call).sort().join("|")
        !== "call_id|child_capability_id|disposition|effects|product_step_id|source_effect_set_hash"
      || !Array.isArray(call.effects) || call.effects.some((effect: unknown) => {
        if (!effect || typeof effect !== "object" || Array.isArray(effect)) return true;
        const keys = Object.keys(effect).sort().join("|");
        const base = ["anchor_proof_hash", "anchor_state", "effect_identity_hash",
          "source_effect_set_hash", "wal_authority_hash"];
        return !["exact_negative", "rejection_settled", "risk_authorized",
          "settled_checkpoint", "unaddressable"]
          .some((outcome) => keys === [...base, outcome].sort().join("|"));
      }))
    || manifest.browser_input_state === "zero" && manifest.input_quiescence_proof !== null
    || manifest.browser_input_state !== "zero" && manifest.input_quiescence_proof === null) return false;
  const proof = manifest.input_quiescence_proof;
  if (proof === null) return true;
  const { proof_hash: proofHash, ...body } = proof;
  return Object.keys(proof).sort().join("|")
      === "browser_history_hash|kind|proof_hash|source_effect_set_hash|unresolved_command_set_hash"
    && proof.kind === "terminal_wal" && proof.browser_history_hash === manifest.browser_history_hash
    && proof.unresolved_command_set_hash === hashCanonical([])
    && proof.source_effect_set_hash === hashCanonical(manifest.replay_calls
      .map((call) => call.source_effect_set_hash).sort())
    && proofHash === hashCanonical(body);
};
export type AcceptedSourceSettlement =
  | Readonly<{ kind: "rejection_settled"; sourceAttemptId: string;
    sourceHandoffSealHash: `sha256:${string}`; effectIdentityHash: `sha256:${string}`;
    evidenceRef: string; evidenceHash: `sha256:${string}`;
    sourceEffectSetHash: `sha256:${string}`;
    productStepId: string; callId: string; childCapabilityId: string }>
  | Readonly<{ kind: "risk_authorized";
    sourceWalAuthorityHash: `sha256:${string}`;
    sourceAnchorProofHash: `sha256:${string}`; sourceAnchorState: "trusted" | "absent";
    sourceHandoffSealHash: `sha256:${string}`; effectIdentityHash: `sha256:${string}`;
    sourceEffectSetHash: `sha256:${string}`;
    productStepId: string; callId: string; childCapabilityId: string }>
  | Readonly<{ kind: "reused_checkpoint"; sourceAttemptId: string;
    sourceHandoffSealHash: `sha256:${string}`; effect: Checkpoint;
    effectIdentityHash: `sha256:${string}`; sourceEffectSetHash: `sha256:${string}`;
    productStepId: string; callId: string; childCapabilityId: string }>;

const matchingCall = (manifest: SignedManifest, proof: SignedCallProof): Call | undefined =>
  manifest.replay_calls.find((call) => call.product_step_id === proof.product_step_id
    && call.call_id === proof.call_id && call.child_capability_id === proof.child_capability_id
    && call.source_effect_set_hash === proof.source_effect_set_hash);

const reusableSettlements = (row: Row, manifest: SignedManifest): AcceptedSourceSettlement[] => {
  if (!manifest.payload_slot_conflict || manifest.replay_calls.length === 0
    || manifest.readback_proofs.length !== manifest.replay_calls.length
    || manifest.readback_proofs.some((proof) => proof.disposition !== "settled_reusable")) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
  }
  const settled: AcceptedSourceSettlement[] = [];
  for (const proof of manifest.readback_proofs) {
    const call = matchingCall(manifest, proof);
    const checkpoints = proof.effects.filter((effect) => effect.settled_checkpoint !== undefined);
    if (!call || checkpoints.length !== proof.effects.length || checkpoints.length === 0) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
    }
    for (const effect of checkpoints) {
      const stableEffect = Object.freeze({
        effect_identity_hash: effect.effect_identity_hash,
        source_effect_set_hash: effect.source_effect_set_hash,
        wal_authority_hash: effect.wal_authority_hash,
        anchor_state: effect.anchor_state,
        anchor_proof_hash: effect.anchor_proof_hash,
        settled_checkpoint: effect.settled_checkpoint!,
      }) as Checkpoint;
      settled.push(Object.freeze({ kind: "reused_checkpoint", sourceAttemptId:
        effect.settled_checkpoint!.source_attempt_id, sourceHandoffSealHash: row.seal_hash,
        effect: stableEffect, effectIdentityHash: effect.effect_identity_hash,
        sourceEffectSetHash: effect.source_effect_set_hash,
        productStepId: proof.product_step_id, callId: proof.call_id,
        childCapabilityId: proof.child_capability_id }));
    }
  }
  return settled;
};

const riskSettlements = (
  row: Row, manifest: SignedManifest, exhausted: readonly SignedCallProof[],
): AcceptedSourceSettlement[] => {
  const settled: AcceptedSourceSettlement[] = [];
  for (const proof of exhausted) {
    if (!matchingCall(manifest, proof)) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
    }
    let exhaustedEffects = 0;
    for (const effect of proof.effects) {
      const exhausted = "exact_negative" in effect && effect.exact_negative !== undefined
        || "unaddressable" in effect && effect.unaddressable !== undefined;
      if (!exhausted) continue;
      exhaustedEffects += 1;
      settled.push(Object.freeze({ kind: "risk_authorized", sourceHandoffSealHash: row.seal_hash,
        sourceWalAuthorityHash: effect.wal_authority_hash,
        sourceAnchorProofHash: effect.anchor_proof_hash, sourceAnchorState: effect.anchor_state,
        effectIdentityHash: effect.effect_identity_hash,
        sourceEffectSetHash: effect.source_effect_set_hash,
        productStepId: proof.product_step_id, callId: proof.call_id,
        childCapabilityId: proof.child_capability_id }));
    }
    if (exhaustedEffects === 0) throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
  }
  return settled;
};

const replaySettlements = (row: Row, manifest: SignedManifest): AcceptedSourceSettlement[] => {
  const exhausted = manifest.readback_proofs.filter((proof) =>
    proof.disposition === "replay_exhausted");
  if (manifest.readback_exhaustion_hash !== hashCanonical(exhausted)) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_REPLAY_INVALID");
  }
  return exhausted.length === 0
    ? reusableSettlements(row, manifest) : riskSettlements(row, manifest, exhausted);
};

const settledRejectionFirstFact = (
  row: Row, manifest: SignedManifest,
): Readonly<{ effectIdentityHash: `sha256:${string}`;
  evidenceRef: string; evidenceHash: `sha256:${string}` }> => {
  const raw = row.first_fact_raw;
  const first = raw === null ? null : JSON.parse(raw) as unknown;
  if (!first || !isAttemptFailureFirstFact(first)
    || manifest.first_fact_raw_hash !== targetlessFirstFactHash(raw)
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

const rejectionSettlement = (row: Row, manifest: SignedManifest): AcceptedSourceSettlement => {
  const first = settledRejectionFirstFact(row, manifest);
  const rejectedCall = manifest.rejected_call;
  if (!rejectedCall || !manifest.replay_calls.some((call) =>
      call.product_step_id === rejectedCall.product_step_id
      && call.call_id === rejectedCall.call_id
      && call.child_capability_id === rejectedCall.child_capability_id
      && call.source_effect_set_hash === rejectedCall.source_effect_set_hash)
    || rejectedCall.effect_identity_hash !== first.effectIdentityHash) {
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
    const raw: unknown = JSON.parse(row.source_manifest_json);
    if (!raw || typeof raw !== "object") throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
    const manifest = raw as SignedManifest;
    const { seal_hash: sealHash, ...body } = manifest;
    if (sealHash !== row.seal_hash || hashCanonical(body) !== sealHash
      || manifest.job_id !== jobId || manifest.source_attempt_id !== row.source_attempt_id) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
    }
    if (!validV44SourceHandoff(raw)) {
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
