import type { ParsedTextInputAbilityInput } from "../contract.js";
import { buildRedactedPreview, detectSensitiveText } from "../shared/text-input-redaction.js";

const WRITE_CHILDREN = new Set(["type-text", "paste-text", "replace-input"]);

export function validateSensitiveText(input: { request: ParsedTextInputAbilityInput }) {
  const payload = WRITE_CHILDREN.has(input.request.childCapabilityId) ? (input.request.inputText ?? "") : "";
  const heuristicallySensitive = payload.length > 0 && detectSensitiveText(payload);
  const policySensitive = input.request.policy.sensitiveTextPolicy.classification === "sensitive"
    || input.request.policy.sensitiveTextPolicy.classification === "restricted";
  const redactedPreview = payload.length > 0
    ? buildRedactedPreview(payload, input.request.policy.redactionPolicy.maxPreviewChars)
    : null;

  if (!heuristicallySensitive && !policySensitive) {
    return {
      ok: true as const,
      sensitiveTextDecision: "allowed" as const,
      redactionDecision: input.request.policy.redactionPolicy.mode === "hash_only"
        ? ("hash_only" as const)
        : input.request.policy.redactionPolicy.mode === "none"
          ? ("none" as const)
          : ("masked" as const),
      redactedPreview,
      dataQualityFlags: [] as string[],
    };
  }

  if (input.request.policy.sensitiveTextPolicy.allowSensitiveWrite !== true) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "sensitive_text_requires_approval" as const,
      reviewRequiredReason: null,
      statusMessage: "Text Input blocked sensitive text because sensitiveTextPolicy.allowSensitiveWrite=false.",
      policyDecision: "block" as const,
      sensitiveTextDecision: "blocked" as const,
      redactionDecision: "masked" as const,
      redactedPreview,
      dataQualityFlags: ["sensitive_text_blocked"],
    };
  }

  if (input.request.policy.sensitiveTextPolicy.requiresHumanApproval && input.request.humanApprovalRef === null) {
    return {
      ok: false as const,
      status: "review_required" as const,
      failureReason: null,
      reviewRequiredReason: "Text Input requires humanApprovalRef before writing sensitive text.",
      statusMessage: "Text Input requires humanApprovalRef before writing sensitive text.",
      policyDecision: "review_required" as const,
      sensitiveTextDecision: "review_required" as const,
      redactionDecision: "masked" as const,
      redactedPreview,
      dataQualityFlags: ["sensitive_text_missing_human_approval"],
    };
  }

  if (input.request.policy.sensitiveTextPolicy.requiresMapPolicyApproval && input.request.mapPolicyApprovalRef === null) {
    return {
      ok: false as const,
      status: "review_required" as const,
      failureReason: null,
      reviewRequiredReason: "Text Input requires mapPolicyApprovalRef before writing sensitive text.",
      statusMessage: "Text Input requires mapPolicyApprovalRef before writing sensitive text.",
      policyDecision: "review_required" as const,
      sensitiveTextDecision: "review_required" as const,
      redactionDecision: "masked" as const,
      redactedPreview,
      dataQualityFlags: ["sensitive_text_missing_map_policy_approval"],
    };
  }

  return {
    ok: true as const,
    sensitiveTextDecision: "allowed" as const,
    redactionDecision: input.request.policy.redactionPolicy.mode === "hash_only"
      ? ("hash_only" as const)
      : input.request.policy.redactionPolicy.mode === "none"
        ? ("none" as const)
        : ("masked" as const),
    redactedPreview,
    dataQualityFlags: [] as string[],
  };
}