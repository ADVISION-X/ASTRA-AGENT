import { POST_ACTION_CHILD_POLICY_MAP } from "../shared/post-action-policy.js";
import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";

export function validatePostActionVerificationInput(request: ParsedPostActionVerificationAbilityInput) {
  const childPolicy = POST_ACTION_CHILD_POLICY_MAP[request.childCapabilityId];
  if (request.expectedOutcome.outcomeType !== childPolicy.expectedOutcomeType) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "missing_expected_outcome" as const,
      reviewRequiredReason: null,
      statusMessage: `Expected outcome ${childPolicy.expectedOutcomeType} is required for ${request.childCapabilityId}.`,
      dataQualityFlags: ["expected_outcome_mismatch"],
      inputDecision: "failed:expected_outcome_mismatch" as const,
    };
  }

  if (!request.requestedBy || !request.sessionId || request.roundId === undefined || request.videoVisitId === undefined || !request.inputRef) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "missing_requested_context" as const,
      reviewRequiredReason: null,
      statusMessage: "Post Action Verification requires requestedBy, sessionId, roundId, videoVisitId, and inputRef bindings.",
      dataQualityFlags: ["requested_context_missing"],
      inputDecision: "failed:missing_requested_context" as const,
    };
  }

  if (request.actionProof.actionStatus !== "success") {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "action_status_not_success" as const,
      reviewRequiredReason: null,
      statusMessage: "Post Action Verification cannot verify a failed or blocked action as successful.",
      dataQualityFlags: ["action_not_success"],
      inputDecision: "failed:action_status_not_success" as const,
    };
  }

  if (!request.actionProof.sourceRuntimeProofRef) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "source_runtime_proof_missing" as const,
      reviewRequiredReason: null,
      statusMessage: "sourceRuntimeProofRef is required for governed verification.",
      dataQualityFlags: ["source_runtime_proof_missing"],
      inputDecision: "failed:source_runtime_proof_missing" as const,
    };
  }

  return {
    ok: true,
    inputDecision: "allow" as const,
  };
}
