import type { ProductionHash } from "../../../mediator/product-plugin-contract.js";

type SourceReadbackObservationIdentity = Readonly<{
  effect_identity_hash: ProductionHash;
  source_effect_set_hash: ProductionHash;
  old_target_ref_hash: ProductionHash;
  old_document_ref_hash: ProductionHash;
  wal_authority_hash: ProductionHash;
  provider_input_delta: 0;
}>;

export type SourceReadbackObservation = SourceReadbackObservationIdentity & Readonly<
  { kind: "settled_checkpoint"; path: "source_checkpoint";
    source_attempt_id: string; source_result_revision: number;
    checkpoint_exact_call_identity_hash: ProductionHash;
    artifact_ref: string; artifact_content_hash: ProductionHash;
    submit_prompt_hash: ProductionHash;
    canonical_conversation_hash: ProductionHash; user_turn_hash: ProductionHash;
    proof_hash: ProductionHash; observed_at: string }
  | { kind: "old_instance_unavailable"; path: "old_target";
    proof_hash: ProductionHash; observed_at: string }
  | { kind: "negative_exact"; path: "old_target" | "exact_conversation";
  target_ref_hash: ProductionHash;
  document_ref_hash: ProductionHash;
  observation_revision_hash: ProductionHash;
  observed_at: string; first_observed_at: string; observation_count: number;
  pending_cause: "exact-user-turn-unavailable" | "adjacent-assistant-missing";
  canonical_conversation_hash: ProductionHash;
  user_turn_hash: ProductionHash;
  }>;

type SourceReadbackEffectIdentity = Readonly<{
  effect_identity_hash: ProductionHash;
  source_effect_set_hash: ProductionHash;
  old_target_ref_hash: ProductionHash;
  old_document_ref_hash: ProductionHash;
  wal_authority_hash: ProductionHash;
  anchor_state: "trusted" | "absent";
  anchor_proof_hash: ProductionHash;
}>;

export type SourceReadbackEffectProof = SourceReadbackEffectIdentity & Readonly<
  { old_path: null; exact_path: null;
    settled_checkpoint: Readonly<{
      source_attempt_id: string; source_result_revision: number;
      checkpoint_exact_call_identity_hash: ProductionHash;
      artifact_ref: string; artifact_content_hash: ProductionHash;
      submit_prompt_hash: ProductionHash;
      canonical_conversation_hash: ProductionHash; user_turn_hash: ProductionHash;
      proof_hash: ProductionHash; observed_at: string; provider_input_delta: 0;
    }> }
  | { old_path: null; exact_path: null; settled_checkpoint?: never;
    rejection_settled: Readonly<{ source_attempt_id: string;
      source_handoff_seal_hash: ProductionHash }> }
  | { old_path: null; exact_path: null; settled_checkpoint?: never;
    risk_authorized: Readonly<{ source_handoff_seal_hash: ProductionHash }> }
  | { settled_checkpoint?: never;
  old_path: Readonly<{ outcome: "instance_unavailable" | "negative_observed";
    proof_hash: ProductionHash; observed_at: string; provider_input_delta: 0;
    target_ref_hash: ProductionHash; document_ref_hash: ProductionHash }>
    | Readonly<{ outcome: "unaddressable_quiesced";
      proof_hash: ProductionHash; settlement_proof_hash: ProductionHash;
      settlement_outcome: "physical_absent" | "quiesced";
      observed_at: string; provider_input_delta: 0;
      target_ref_hash: ProductionHash; document_ref_hash: ProductionHash }>;
  exact_path: Readonly<{ outcome: "negative_observed"; proof_hash: ProductionHash;
    target_ref_hash: ProductionHash; document_ref_hash: ProductionHash;
    observed_at: string; provider_input_delta: 0 }> | null;
}>;

export type SourceReadbackCallProof = Readonly<{
  product_step_id: string; call_id: string; child_capability_id: string;
  source_effect_set_hash: ProductionHash;
  disposition: "settled_reusable" | "replay_exhausted" | "historical_settled";
  effects: readonly SourceReadbackEffectProof[];
}>;

export type SourceAttemptHandoff = Readonly<{
  kind: "attempt_handoff" | "delivery_priority_replay";
  job_id: string; source_attempt_id: string;
  source_task_hash: ProductionHash | null;
  first_fact_raw_hash: ProductionHash | null;
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
  browser_target_settled: boolean;
  target_settlement_hash: ProductionHash;
  readback_exhaustion_hash: ProductionHash | null;
  seal_hash: ProductionHash;
}>;

