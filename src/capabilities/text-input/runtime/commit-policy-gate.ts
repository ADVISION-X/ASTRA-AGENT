import type { ParsedTextInputAbilityInput } from "../contract.js";
import { buildStableTextInputRef } from "../shared/text-input-types.js";

const buildCommitPolicyGatePassResult = (commitPolicyRef: string | null) => ({
  ok: true as const,
  commitPolicyRef,
  dataQualityFlags: [] as string[],
});

const buildCommitPolicyGateFailureResult = (input: {
  status: "failed" | "review_required";
  failureReason: "commit_disabled" | "commit_ref_required" | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  policyDecision: "block" | "review_required";
  dataQualityFlag: string;
}) => ({
  ok: false as const,
  status: input.status,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason,
  statusMessage: input.statusMessage,
  policyDecision: input.policyDecision,
  keyPolicyDecision: "blocked_enter" as const,
  commitPolicyRef: null,
  dataQualityFlags: [input.dataQualityFlag],
});

const validateCommitPolicyEnabled = (input: { request: ParsedTextInputAbilityInput }) => {
  if (input.request.policy.commitPolicy.allowCommit === true) {
    return null;
  }

  return buildCommitPolicyGateFailureResult({
    status: "failed",
    failureReason: "commit_disabled",
    reviewRequiredReason: null,
    statusMessage: "Text Input commit-input requires commitPolicy.allowCommit=true.",
    policyDecision: "block",
    dataQualityFlag: "commit_policy_blocked",
  });
};

const validateCommitPolicyApprovedCommitRef = (input: { request: ParsedTextInputAbilityInput }) => {
  if (!input.request.policy.commitPolicy.requireApprovedCommitRef || input.request.approvedCommitRef.length > 0) {
    return null;
  }

  return buildCommitPolicyGateFailureResult({
    status: "failed",
    failureReason: "commit_ref_required",
    reviewRequiredReason: null,
    statusMessage: "Text Input commit-input requires approvedCommitRef.",
    policyDecision: "block",
    dataQualityFlag: "approved_commit_ref_missing",
  });
};

const validateCommitPolicyHumanApproval = (input: { request: ParsedTextInputAbilityInput }) => {
  if (!input.request.policy.commitPolicy.requireHumanApproval || input.request.humanApprovalRef !== null) {
    return null;
  }

  return buildCommitPolicyGateFailureResult({
    status: "review_required",
    failureReason: null,
    reviewRequiredReason: "Text Input commit-input requires humanApprovalRef before commit execution.",
    statusMessage: "Text Input commit-input requires humanApprovalRef before commit execution.",
    policyDecision: "review_required",
    dataQualityFlag: "commit_missing_human_approval",
  });
};

const validateCommitPolicyMapApproval = (input: { request: ParsedTextInputAbilityInput }) => {
  if (!input.request.policy.commitPolicy.requireMapPolicyApproval || input.request.mapPolicyApprovalRef !== null) {
    return null;
  }

  return buildCommitPolicyGateFailureResult({
    status: "review_required",
    failureReason: null,
    reviewRequiredReason: "Text Input commit-input requires mapPolicyApprovalRef before commit execution.",
    statusMessage: "Text Input commit-input requires mapPolicyApprovalRef before commit execution.",
    policyDecision: "review_required",
    dataQualityFlag: "commit_missing_map_policy_approval",
  });
};

const validateCommitPolicyAllowedKeys = (input: { request: ParsedTextInputAbilityInput }) => {
  if (input.request.policy.commitPolicy.allowedCommitKeys.includes(input.request.key)) {
    return null;
  }

  return buildCommitPolicyGateFailureResult({
    status: "failed",
    failureReason: "commit_disabled",
    reviewRequiredReason: null,
    statusMessage: `Text Input commit-input key ${input.request.key} is not authorized by commitPolicy.allowedCommitKeys.`,
    policyDecision: "block",
    dataQualityFlag: "commit_key_not_approved",
  });
};

const COMMIT_POLICY_VALIDATORS = [
  validateCommitPolicyEnabled,
  validateCommitPolicyApprovedCommitRef,
  validateCommitPolicyHumanApproval,
  validateCommitPolicyMapApproval,
  validateCommitPolicyAllowedKeys,
] as const;

const resolveCommitPolicyValidationFailure = (input: { request: ParsedTextInputAbilityInput }) => {
  for (const validator of COMMIT_POLICY_VALIDATORS) {
    const result = validator(input);
    if (result) {
      return result;
    }
  }

  return null;
};

export function validateCommitPolicy(input: { request: ParsedTextInputAbilityInput }) {
  if (input.request.childCapabilityId !== "commit-input") {
    return buildCommitPolicyGatePassResult(null);
  }

  const failure = resolveCommitPolicyValidationFailure(input);
  if (failure) {
    return failure;
  }

  return buildCommitPolicyGatePassResult(buildStableTextInputRef("text-input-commit-policy", [
    input.request.policy.commitPolicy,
    input.request.approvedCommitRef,
  ]));
}