import type { ParsedAiAbilityInput } from "../contract.js";

import { collectForbiddenActionTerms } from "../shared/ai-policy.js";

export function evaluateAiSafetyPolicy(input: { request: ParsedAiAbilityInput; promptForbiddenOutputs: string[]; provisionalOutput: unknown }): { decision: "allow" | "review_required" | "blocked"; reason: string | null; flags: string[] } {
  const violations = [
    ...collectForbiddenActionTerms(input.provisionalOutput),
    ...collectForbiddenActionTerms(input.promptForbiddenOutputs),
  ];

  if (violations.length === 0) {
    return { decision: "allow", reason: null, flags: [] };
  }

  if (input.request.safetyPolicy.reviewOnPolicyViolation) {
    return { decision: "review_required", reason: "safety_policy_blocked", flags: violations };
  }

  return { decision: "blocked", reason: "safety_policy_blocked", flags: violations };
}
