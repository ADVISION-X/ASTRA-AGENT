import type { AiChildContract, ParsedAiAbilityInput } from "../contract.js";

export function evaluateAiCostPolicy(request: ParsedAiAbilityInput, childContract: AiChildContract): { decision: "allow" | "review_required" | "blocked" | "not_applicable"; reason: string | null } {
  if (childContract.providerKind === "local" || childContract.providerKind === "internal") {
    return { decision: "not_applicable", reason: null };
  }

  if (request.costPolicy.maxEstimatedCost === null) {
    return { decision: "blocked", reason: "cost_policy_blocked" };
  }

  if (request.costPolicy.maxEstimatedCost <= 0) {
    return { decision: "review_required", reason: "cost_policy_blocked" };
  }

  return { decision: "allow", reason: null };
}
