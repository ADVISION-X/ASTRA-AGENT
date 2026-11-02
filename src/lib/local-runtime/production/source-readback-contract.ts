import type { ProductionHash } from "../../../mediator/product-plugin-contract.js";

type ObservationIdentity = Readonly<{
  effect_identity_hash: ProductionHash; source_effect_set_hash: ProductionHash;
  wal_authority_hash: ProductionHash; provider_input_delta: 0;
}>;
export type SourceReadbackObservation = ObservationIdentity & Readonly<
  { kind: "settled_checkpoint"; path: "source_checkpoint";
    source_attempt_id: string; source_result_revision: number;
    checkpoint_exact_call_identity_hash: ProductionHash;
    artifact_ref: string; artifact_content_hash: ProductionHash;
    submit_prompt_hash: ProductionHash;
    canonical_conversation_hash: ProductionHash; user_turn_hash: ProductionHash;
    proof_hash: ProductionHash; observed_at: string }
  | { kind: "negative_exact"; path: "exact_conversation";
    observation_revision_hash: ProductionHash;
    observed_at: string; first_observed_at: string; observation_count: number;
    pending_cause: "exact-user-turn-unavailable" | "adjacent-assistant-missing";
    canonical_conversation_hash: ProductionHash; user_turn_hash: ProductionHash }
>;

type EffectIdentity = Readonly<{
  effect_identity_hash: ProductionHash; source_effect_set_hash: ProductionHash;
  wal_authority_hash: ProductionHash; anchor_state: "trusted" | "absent";
  anchor_proof_hash: ProductionHash;
}>;
type SettledCheckpoint = Readonly<{
  source_attempt_id: string; source_result_revision: number;
  checkpoint_exact_call_identity_hash: ProductionHash;
  artifact_ref: string; artifact_content_hash: ProductionHash;
  submit_prompt_hash: ProductionHash;
  canonical_conversation_hash: ProductionHash; user_turn_hash: ProductionHash;
  proof_hash: ProductionHash; observed_at: string; provider_input_delta: 0;
}>;
export type SourceReadbackEffectProof = EffectIdentity & Readonly<
  { settled_checkpoint: SettledCheckpoint; rejection_settled?: never;
    risk_authorized?: never; exact_negative?: never; unaddressable?: never; unresolved?: never }
  | { rejection_settled: Readonly<{ source_attempt_id: string;
      source_handoff_seal_hash: ProductionHash }>;
    settled_checkpoint?: never; risk_authorized?: never;
    exact_negative?: never; unaddressable?: never; unresolved?: never }
  | { risk_authorized: Readonly<{ source_handoff_seal_hash: ProductionHash }>;
    settled_checkpoint?: never; rejection_settled?: never;
    exact_negative?: never; unaddressable?: never; unresolved?: never }
  | { exact_negative: Readonly<{ proof_hash: ProductionHash;
      first_observed_at: string; observed_at: string; observation_count: number;
      pending_cause: "exact-user-turn-unavailable" | "adjacent-assistant-missing";
      canonical_conversation_hash: ProductionHash; user_turn_hash: ProductionHash;
      provider_input_delta: 0 }>;
    settled_checkpoint?: never; rejection_settled?: never;
    risk_authorized?: never; unaddressable?: never; unresolved?: never }
  | { unaddressable: Readonly<{ proof_hash: ProductionHash;
      observed_at: string; provider_input_delta: 0 }>;
    settled_checkpoint?: never; rejection_settled?: never;
    risk_authorized?: never; exact_negative?: never; unresolved?: never }
  | Readonly<{ unresolved: Readonly<{ source_attempt_id: string; source_result_revision: number;
      wal_state: "DISPATCHED" | "CONFIRMED" | "REJECTED";
      mutation_outcome: "no" | "dispatched" | "confirmed"; physical_input_count: number;
      observed_at: string; provider_input_delta: 0 }>;
    settled_checkpoint?: never; rejection_settled?: never; risk_authorized?: never;
    exact_negative?: never; unaddressable?: never }>
>;
export type SourceReadbackCallProof = Readonly<{
  product_step_id: string; call_id: string; child_capability_id: string;
  source_effect_set_hash: ProductionHash;
  disposition: "settled_reusable" | "replay_exhausted" | "historical_settled" | "unresolved";
  effects: readonly SourceReadbackEffectProof[];
}>;
export type InputQuiescenceProof = Readonly<{
  kind: "terminal_wal"; browser_history_hash: ProductionHash;
  source_effect_set_hash: ProductionHash; unresolved_command_set_hash: ProductionHash;
  proof_hash: ProductionHash;
}>;
export type SourceAttemptHandoff = Readonly<{
  kind: "attempt_handoff" | "delivery_priority_replay";
  job_id: string; source_attempt_id: string;
  source_task_hash: ProductionHash | null; first_fact_raw_hash: ProductionHash | null;
  outbox_history_hash: ProductionHash; outbox_candidate_count: number;
  payload_slot_conflict: Readonly<{
    old_request_id: string; old_payload_hash: ProductionHash; old_receipt_hash: ProductionHash;
    new_request_id: string; new_payload_hash: ProductionHash;
  }> | null;
  browser_history_hash: ProductionHash; browser_row_count: number;
  browser_input_state: "zero" | "possible" | "unknown";
  replay_calls: readonly Readonly<{ product_step_id: string; call_id: string;
    child_capability_id: string; source_effect_set_hash: ProductionHash }>[];
  rejected_call: Readonly<{ product_step_id: string; call_id: string;
    child_capability_id: string; source_effect_set_hash: ProductionHash;
    effect_identity_hash: ProductionHash }> | null;
  readback_proofs: readonly SourceReadbackCallProof[];
  input_quiescence_proof: InputQuiescenceProof | null;
  readback_exhaustion_hash: ProductionHash | null; seal_hash: ProductionHash;
}>;
