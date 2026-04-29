import { POST_ACTION_CHILD_OUTCOME_MAP } from "../shared/post-action-policy.js";
import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";

export function validatePostActionVerificationInput(request: ParsedPostActionVerificationAbilityInput) {
  const expectedOutcomeType = POST_ACTION_CHILD_OUTCOME_MAP[request.childCapabilityId];
  if (request.expectedOutcome.outcomeType !== expectedOutcomeType) {
    return {
      ok: false,
      status: "blocked" as const,
      failureReason: "missing_expected_outcome" as const,
      reviewRequiredReason: null,
      statusMessage: `Expected outcome ${expectedOutcomeType} is required for ${request.childCapabilityId}.`,
      dataQualityFlags: ["expected_outcome_mismatch"],
      inputDecision: "blocked:expected_outcome_mismatch" as const,
    };
  }

  if (!request.requestedBy || !request.sessionId || request.roundId === undefined || request.videoVisitId === undefined) {
    return {
      ok: false,
      status: "blocked" as const,
      failureReason: "missing_requested_context" as const,
      reviewRequiredReason: null,
      statusMessage: "Post Action Verification requires requestedBy, sessionId, roundId, and videoVisitId bindings.",
      dataQualityFlags: ["requested_context_missing"],
      inputDecision: "blocked:missing_requested_context" as const,
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

  return {
    ok: true,
    inputDecision: "allow" as const,
  };
}
