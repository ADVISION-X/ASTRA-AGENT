import { POST_ACTION_CHILD_POLICY_MAP } from "../shared/post-action-policy.js";
import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";

function createPolicyGateFailure(statusMessage: string, dataQualityFlag: string, policyDecision: "failed:verification_mode_mismatch" | "failed:after_evidence_policy_mismatch" | "failed:before_after_policy_mismatch" | "failed:confidence_policy_invalid") {
  return {
    ok: false as const,
    status: "failed" as const,
    failureReason: "policy_blocked" as const,
    reviewRequiredReason: null,
    statusMessage,
    dataQualityFlags: [dataQualityFlag],
    policyDecision,
  };
}

function resolveVerificationModeFailure(request: ParsedPostActionVerificationAbilityInput) {
  const childPolicy = POST_ACTION_CHILD_POLICY_MAP[request.childCapabilityId];
  if (request.verificationPolicy.verificationMode === childPolicy.verificationMode) {
    return null;
  }

  return createPolicyGateFailure(
    `${request.childCapabilityId} requires verificationMode=${childPolicy.verificationMode}.`,
    "verification_mode_mismatch",
    "failed:verification_mode_mismatch",
  );
}

function resolveAfterEvidenceFailure(request: ParsedPostActionVerificationAbilityInput) {
  const childPolicy = POST_ACTION_CHILD_POLICY_MAP[request.childCapabilityId];
  if (request.verificationPolicy.requireAfterEvidence === childPolicy.requireAfterEvidence) {
    return null;
  }

  return createPolicyGateFailure(
    `${request.childCapabilityId} requires requireAfterEvidence=${childPolicy.requireAfterEvidence}.`,
    "after_evidence_policy_mismatch",
    "failed:after_evidence_policy_mismatch",
  );
}

function resolveBeforeAfterComparisonFailure(request: ParsedPostActionVerificationAbilityInput) {
  const childPolicy = POST_ACTION_CHILD_POLICY_MAP[request.childCapabilityId];
  if (request.verificationPolicy.requireBeforeAfterComparison === childPolicy.requireBeforeAfterComparison) {
    return null;
  }

  return createPolicyGateFailure(
    `${request.childCapabilityId} requires requireBeforeAfterComparison=${childPolicy.requireBeforeAfterComparison}.`,
    "before_after_policy_mismatch",
    "failed:before_after_policy_mismatch",
  );
}

function resolveConfidencePolicyFailure(request: ParsedPostActionVerificationAbilityInput) {
  if (request.confidencePolicy.minimumConfidence > 0 && request.confidencePolicy.minimumConfidence <= 1) {
    return null;
  }

  return createPolicyGateFailure(
    "minimumConfidence must be within (0, 1].",
    "confidence_policy_invalid",
    "failed:confidence_policy_invalid",
  );
}

export function validateVerificationPolicy(request: ParsedPostActionVerificationAbilityInput) {
  return resolveVerificationModeFailure(request)
    ?? resolveAfterEvidenceFailure(request)
    ?? resolveBeforeAfterComparisonFailure(request)
    ?? resolveConfidencePolicyFailure(request)
    ?? {
      ok: true as const,
      policyDecision: "allow" as const,
    };
}
