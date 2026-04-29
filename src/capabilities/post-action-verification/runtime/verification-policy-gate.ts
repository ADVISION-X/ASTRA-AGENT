import { POST_ACTION_CHILD_VERIFICATION_MODE_MAP } from "../shared/post-action-policy.js";
import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";

export function validateVerificationPolicy(request: ParsedPostActionVerificationAbilityInput) {
  const expectedMode = POST_ACTION_CHILD_VERIFICATION_MODE_MAP[request.childCapabilityId];
  if (request.verificationPolicy.verificationMode !== expectedMode) {
    return {
      ok: false,
      status: "blocked" as const,
      failureReason: "policy_blocked" as const,
      reviewRequiredReason: null,
      statusMessage: `${request.childCapabilityId} requires verificationMode=${expectedMode}.`,
      dataQualityFlags: ["verification_mode_mismatch"],
      policyDecision: "blocked:verification_mode_mismatch" as const,
    };
  }

  if (request.verificationPolicy.verificationMode === "observation_only" && request.childCapabilityId !== "verify-page-opened") {
    return {
      ok: false,
      status: "blocked" as const,
      failureReason: "policy_blocked" as const,
      reviewRequiredReason: null,
      statusMessage: "Observation-only verification is not allowed for this action risk profile.",
      dataQualityFlags: ["observation_only_disallowed"],
      policyDecision: "blocked:observation_only_disallowed" as const,
    };
  }

  if (request.confidencePolicy.minimumConfidence <= 0 || request.confidencePolicy.minimumConfidence > 1) {
    return {
      ok: false,
      status: "blocked" as const,
      failureReason: "policy_blocked" as const,
      reviewRequiredReason: null,
      statusMessage: "minimumConfidence must be within (0, 1].",
      dataQualityFlags: ["confidence_policy_invalid"],
      policyDecision: "blocked:confidence_policy_invalid" as const,
    };
  }

  return {
    ok: true,
    policyDecision: "allow" as const,
  };
}
