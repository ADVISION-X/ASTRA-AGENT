import type { ParsedTextInputAbilityInput } from "../contract.js";

const ARROW_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

export function validateKeyPolicy(input: { request: ParsedTextInputAbilityInput }) {
  if (input.request.childCapabilityId !== "press-key") {
    return {
      ok: true as const,
      keyPolicyDecision: "allowed" as const,
      dataQualityFlags: [] as string[],
    };
  }

  if (ARROW_KEYS.has(input.request.key) && input.request.policy.keyPolicy.allowArrowNavigation !== true) {
    return {
      ok: false as const,
      status: "failed" as const,
      failureReason: "key_forbidden" as const,
      reviewRequiredReason: null,
      statusMessage: `Text Input key ${input.request.key} is blocked by keyPolicy.allowArrowNavigation=false.`,
      policyDecision: "block" as const,
      keyPolicyDecision: "blocked_modifier" as const,
      dataQualityFlags: ["key_policy_blocked_arrow_navigation"],
    };
  }

  return {
    ok: true as const,
    keyPolicyDecision: "allowed" as const,
    dataQualityFlags: [] as string[],
  };
}