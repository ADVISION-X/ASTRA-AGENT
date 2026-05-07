import type { ParsedAiAbilityInput } from "../contract.js";

import { collectForbiddenActionTerms } from "../shared/ai-policy.js";

const STRUCTURED_VISION_TASK_TYPES = new Set<ParsedAiAbilityInput["taskType"]>([
  "product_presence_judgment",
  "visual_observation",
  "visual_target_candidate_analysis",
]);

export function evaluateAiSafetyPolicy(input: { request: ParsedAiAbilityInput; promptForbiddenOutputs: string[]; provisionalOutput: unknown }): { decision: "allow" | "review_required" | "blocked"; reason: string | null; flags: string[] } {
  if (STRUCTURED_VISION_TASK_TYPES.has(input.request.taskType)) {
    return { decision: "allow", reason: null, flags: [] };
  }

  const violations = collectForbiddenActionTerms(input.provisionalOutput);

  if (violations.length === 0) {
    return { decision: "allow", reason: null, flags: [] };
  }

  if (input.request.safetyPolicy.reviewOnPolicyViolation) {
    return { decision: "review_required", reason: "safety_policy_blocked", flags: violations };
  }

  return { decision: "blocked", reason: "safety_policy_blocked", flags: violations };
}
