import type { ParsedTextInputAbilityInput } from "../contract.js";
import { buildStableTextInputRef } from "../shared/text-input-types.js";

export function validateCommitPolicy(input: { request: ParsedTextInputAbilityInput }) {
  if (input.request.childCapabilityId !== "commit-input") {
    return {
      ok: true as const,
      commitPolicyRef: null,
      dataQualityFlags: [] as string[],
    };
  }

  if (input.request.policy.commitPolicy.allowCommit !== true) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "commit_disabled" as const,
      reviewRequiredReason: null,
      statusMessage: "Text Input commit-input requires commitPolicy.allowCommit=true.",
      policyDecision: "block" as const,
      keyPolicyDecision: "blocked_enter" as const,
      commitPolicyRef: null,
      dataQualityFlags: ["commit_policy_blocked"],
    };
  }

  if (input.request.policy.commitPolicy.requireApprovedCommitRef && input.request.approvedCommitRef.length === 0) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "commit_ref_required" as const,
      reviewRequiredReason: null,
      statusMessage: "Text Input commit-input requires approvedCommitRef.",
      policyDecision: "block" as const,
      keyPolicyDecision: "blocked_enter" as const,
      commitPolicyRef: null,
      dataQualityFlags: ["approved_commit_ref_missing"],
    };
  }

  if (input.request.policy.commitPolicy.requireHumanApproval && input.request.humanApprovalRef === null) {
    return {
      ok: false as const,
      status: "review_required" as const,
      failureReason: null,
      reviewRequiredReason: "Text Input commit-input requires humanApprovalRef before commit execution.",
      statusMessage: "Text Input commit-input requires humanApprovalRef before commit execution.",
      policyDecision: "review_required" as const,
      keyPolicyDecision: "blocked_enter" as const,
      commitPolicyRef: null,
      dataQualityFlags: ["commit_missing_human_approval"],
    };
  }

  if (input.request.policy.commitPolicy.requireMapPolicyApproval && input.request.mapPolicyApprovalRef === null) {
    return {
      ok: false as const,
      status: "review_required" as const,
      failureReason: null,
      reviewRequiredReason: "Text Input commit-input requires mapPolicyApprovalRef before commit execution.",
      statusMessage: "Text Input commit-input requires mapPolicyApprovalRef before commit execution.",
      policyDecision: "review_required" as const,
      keyPolicyDecision: "blocked_enter" as const,
      commitPolicyRef: null,
      dataQualityFlags: ["commit_missing_map_policy_approval"],
    };
  }

  if (!input.request.policy.commitPolicy.allowedCommitKeys.includes(input.request.key)) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "commit_disabled" as const,
      reviewRequiredReason: null,
      statusMessage: `Text Input commit-input key ${input.request.key} is not authorized by commitPolicy.allowedCommitKeys.`,
      policyDecision: "block" as const,
      keyPolicyDecision: "blocked_enter" as const,
      commitPolicyRef: null,
      dataQualityFlags: ["commit_key_not_approved"],
    };
  }

  return {
    ok: true as const,
    commitPolicyRef: buildStableTextInputRef("text-input-commit-policy", [
      input.request.policy.commitPolicy,
      input.request.approvedCommitRef,
    ]),
    dataQualityFlags: [] as string[],
  };
}