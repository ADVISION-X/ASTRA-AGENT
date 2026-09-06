import type { ProductionHash } from "./contracts.js";

export type ProductionLeaseRelease =
  | Readonly<{
    reasonCode: "CAPABILITY_CHANGED_BEFORE_ACCEPT" | "LEASE_SAFETY_BUDGET_EXHAUSTED" | "LOCAL_CAPACITY_CHANGED";
    receiverCheckpoint: null;
    confirmedSubmit: null;
  }>
  | Readonly<{
    reasonCode: "POST_CHECKPOINT_RECEIVER_FAULT";
    receiverCheckpoint: Readonly<{
      artifact_ref: string;
      raw_dom_hash: ProductionHash;
      semantic_text_hash: ProductionHash;
    }>;
    confirmedSubmit: null;
  }>
  | Readonly<{
    reasonCode: "POST_SUBMIT_READBACK_FAULT";
    receiverCheckpoint: null;
    confirmedSubmit: Readonly<{
      cause_code: string;
      exact_call_identity_hash: ProductionHash;
      outcome: "CONFIRMED";
      terminal_at: string;
      readback_mutation_outcome: "no";
      evidence_ref: string;
      evidence_hash: ProductionHash;
    }>;
  }>
  | Readonly<{
    reasonCode: "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED";
    receiverCheckpoint: Readonly<{
      artifact_ref: string;
      raw_dom_hash: ProductionHash;
      semantic_text_hash: ProductionHash;
    }> | null;
    confirmedSubmit: Readonly<{
      cause_code: string;
      exact_call_identity_hash: ProductionHash;
      outcome: "CONFIRMED";
      terminal_at: string;
      readback_mutation_outcome: "no";
      evidence_ref: string;
      evidence_hash: ProductionHash;
    }> | null;
  }>;
