import type { AiChildContract, ParsedAiAbilityInput } from "../contract.js";

export function evaluateAiDataPolicy(request: ParsedAiAbilityInput, childContract: AiChildContract): { decision: "allow" | "review_required" | "blocked" | "not_applicable"; reason: string | null } {
  if (childContract.providerKind === "local" || childContract.providerKind === "internal") {
    return { decision: "not_applicable", reason: null };
  }

  if (!request.dataPolicy.allowExternalTransmission) {
    return { decision: "blocked", reason: "data_policy_blocked" };
  }

  if (!request.dataPolicy.redactSensitiveData) {
    return { decision: "review_required", reason: "data_policy_blocked" };
  }

  return { decision: "allow", reason: null };
}
