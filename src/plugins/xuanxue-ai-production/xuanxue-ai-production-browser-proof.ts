export type AgentBrowserAuthorityWindowProofV5 = Readonly<{
  window_index: number;
  worker_identity_hash: string;
  worker_lease_epoch_hash: string;
  worker_execution_fence_hash: string;
  authority_ref_hash: string;
  authority_certificate_hash: string;
  profile_enrollment_hash: string;
  chrome_process_incarnation_hash: string;
  artifact_set_hash: string;
  activation_tuple_hash: string;
  release_security_policy_hash: string;
  auth_transcript_hash: string;
  liveness_lease_chain_hash: string;
  controller_incarnation_hash: string;
  websocket_connection_generation_hash: string;
  session_workspace_approval_hash: string;
  capability_set_hash: string;
  execution_fence_hash: string;
  first_command_sequence: string;
  last_command_sequence: string;
  action_receipt_subtree_hash: string;
  closed_reason: "COMPLETED" | "CHECKPOINT_HANDOVER" | "FAILED" | "OUTCOME_UNKNOWN";
}>;

export type AgentBrowserAuthorityProofV5 = Readonly<{
  schema_version: "xuanxue-agent-browser-authority-proof-v5";
  browser_required: true;
  windows: readonly AgentBrowserAuthorityWindowProofV5[];
  elected_worker_chain_hash: string;
  handover_receipt_chain_hash: string;
  browser_action_receipt_root_hash: string;
  no_action_during_authority_absence: true;
  unresolved_outcome_unknown_count: 0;
}>;

export type AgentRuntimeReceiptV5 = Readonly<{
  schema_version: "xuanxue-agent-runtime-receipt-v5";
  request_id: string;
  status: "complete" | "failed" | "blocked";
  execution_id: string;
  run_id: string;
  conversation_id: string;
  candidate_hash: string;
  browser_required: boolean;
  browser_proof: AgentBrowserAuthorityProofV5 | null;
  evidence_refs: readonly string[];
}>;

const requireNonEmpty = (value: string, field: string): string => {
  if (!value.trim()) throw new Error(`XUANXUE_BROWSER_PROOF_FIELD_EMPTY:${field}`);
  return value;
};

export const produceAgentBrowserAuthorityProofV5 = (
  proof: AgentBrowserAuthorityProofV5,
): AgentBrowserAuthorityProofV5 => {
  if (proof.schema_version !== "xuanxue-agent-browser-authority-proof-v5") {
    throw new Error("XUANXUE_BROWSER_PROOF_SCHEMA_INVALID");
  }
  if (!proof.browser_required || !proof.no_action_during_authority_absence) {
    throw new Error("XUANXUE_BROWSER_PROOF_AUTHORITY_WINDOW_INVALID");
  }
  if (proof.windows.length === 0 || proof.unresolved_outcome_unknown_count !== 0) {
    throw new Error("XUANXUE_BROWSER_PROOF_WINDOW_CHAIN_INVALID");
  }
  proof.windows.forEach((window, index) => {
    if (window.window_index !== index) {
      throw new Error("XUANXUE_BROWSER_PROOF_WINDOW_ORDER_INVALID");
    }
    requireNonEmpty(window.worker_execution_fence_hash, "worker_execution_fence_hash");
    requireNonEmpty(window.authority_certificate_hash, "authority_certificate_hash");
    requireNonEmpty(window.websocket_connection_generation_hash, "websocket_connection_generation_hash");
    requireNonEmpty(window.session_workspace_approval_hash, "session_workspace_approval_hash");
    requireNonEmpty(window.first_command_sequence, "first_command_sequence");
    requireNonEmpty(window.last_command_sequence, "last_command_sequence");
    requireNonEmpty(window.action_receipt_subtree_hash, "action_receipt_subtree_hash");
  });
  requireNonEmpty(proof.elected_worker_chain_hash, "elected_worker_chain_hash");
  requireNonEmpty(proof.handover_receipt_chain_hash, "handover_receipt_chain_hash");
  requireNonEmpty(proof.browser_action_receipt_root_hash, "browser_action_receipt_root_hash");
  return Object.freeze(proof);
};

export const createAgentRuntimeReceiptV5 = (input: {
  requestId: string;
  status: "complete" | "failed" | "blocked";
  executionId: string;
  runId: string;
  conversationId: string;
  candidateHash: string;
  browserRequired: boolean;
  browserAuthorityProof: AgentBrowserAuthorityProofV5 | null;
  evidenceRefs: readonly string[];
}): AgentRuntimeReceiptV5 => {
  if (!input.requestId.trim() || !input.executionId.trim() || !input.runId.trim()
    || !input.conversationId.trim() || !input.candidateHash.trim()
    || input.evidenceRefs.length === 0 || input.evidenceRefs.some((ref) => !ref.trim())) {
    throw new Error("XUANXUE_RUNTIME_RECEIPT_V5_IDENTITY_INVALID");
  }
  if (input.browserRequired && !input.browserAuthorityProof) {
    throw new Error("XUANXUE_RUNTIME_RECEIPT_BROWSER_PROOF_MISSING");
  }
  const browserAuthorityProof = input.browserAuthorityProof
    ? produceAgentBrowserAuthorityProofV5(input.browserAuthorityProof)
    : null;
  return Object.freeze({
    schema_version: "xuanxue-agent-runtime-receipt-v5" as const,
    request_id: input.requestId,
    status: input.status,
    execution_id: input.executionId,
    run_id: input.runId,
    conversation_id: input.conversationId,
    candidate_hash: input.candidateHash,
    browser_required: input.browserRequired,
    browser_proof: browserAuthorityProof,
    evidence_refs: [...input.evidenceRefs],
  });
};
