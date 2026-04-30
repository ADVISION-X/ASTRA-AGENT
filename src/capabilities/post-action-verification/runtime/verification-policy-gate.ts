import { POST_ACTION_CHILD_POLICY_MAP } from "../shared/post-action-policy.js";
import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";

export function validateVerificationPolicy(request: ParsedPostActionVerificationAbilityInput) {
  const childPolicy = POST_ACTION_CHILD_POLICY_MAP[request.childCapabilityId];
  if (request.verificationPolicy.verificationMode !== childPolicy.verificationMode) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "policy_blocked" as const,
      reviewRequiredReason: null,
      statusMessage: `${request.childCapabilityId} requires verificationMode=${childPolicy.verificationMode}.`,
      dataQualityFlags: ["verification_mode_mismatch"],
      policyDecision: "failed:verification_mode_mismatch" as const,
    };
  }

  if (request.verificationPolicy.requireAfterEvidence !== childPolicy.requireAfterEvidence) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "policy_blocked" as const,
      reviewRequiredReason: null,
      statusMessage: `${request.childCapabilityId} requires requireAfterEvidence=${childPolicy.requireAfterEvidence}.`,
      dataQualityFlags: ["after_evidence_policy_mismatch"],
      policyDecision: "failed:after_evidence_policy_mismatch" as const,
    };
  }

  if (request.verificationPolicy.requireBeforeAfterComparison !== childPolicy.requireBeforeAfterComparison) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "policy_blocked" as const,
      reviewRequiredReason: null,
      statusMessage: `${request.childCapabilityId} requires requireBeforeAfterComparison=${childPolicy.requireBeforeAfterComparison}.`,
      dataQualityFlags: ["before_after_policy_mismatch"],
      policyDecision: "failed:before_after_policy_mismatch" as const,
    };
  }

  if (request.confidencePolicy.minimumConfidence <= 0 || request.confidencePolicy.minimumConfidence > 1) {
    return {
      ok: false,
      status: "failed" as const,
      failureReason: "policy_blocked" as const,
      reviewRequiredReason: null,
      statusMessage: "minimumConfidence must be within (0, 1].",
      dataQualityFlags: ["confidence_policy_invalid"],
      policyDecision: "failed:confidence_policy_invalid" as const,
    };
  }

  return {
    ok: true,
    policyDecision: "allow" as const,
  };
}
