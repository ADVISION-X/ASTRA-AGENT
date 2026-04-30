import type { ParsedTextInputAbilityInput } from "../contract.js";

export function validateTextPolicy(input: { request: ParsedTextInputAbilityInput }) {
  if (input.request.policy.primitiveTimeoutMs > input.request.policy.maxDurationMs) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "output_boundary_failed" as const,
      reviewRequiredReason: null,
      statusMessage: "Text Input requires primitiveTimeoutMs to stay within maxDurationMs.",
      policyDecision: "block" as const,
      dataQualityFlags: ["policy_timeout_exceeds_max_duration"],
    };
  }

  if (input.request.childCapabilityId === "replace-input" && input.request.policy.replacePolicy.allowReplace !== true) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "output_boundary_failed" as const,
      reviewRequiredReason: null,
      statusMessage: "Text Input replace-input requires replacePolicy.allowReplace=true.",
      policyDecision: "block" as const,
      dataQualityFlags: ["replace_policy_blocked"],
    };
  }

  return {
    ok: true as const,
    policyDecision: "allow" as const,
    dataQualityFlags: [] as string[],
  };
}