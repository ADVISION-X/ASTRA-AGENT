import type { AiChildContract, ParsedAiAbilityInput } from "../contract.js";

export function evaluateAiProviderPolicy(request: ParsedAiAbilityInput, childContract: AiChildContract): { decision: "allow" | "review_required" | "blocked" | "disabled"; reason: string | null } {
  if (childContract.implementationStatus === "disabled_by_policy" || childContract.providerKind === "future") {
    return { decision: "disabled", reason: "provider_disabled" };
  }

  if (!request.providerPolicy.providerAllowlist.includes(childContract.childCapabilityId)) {
    return { decision: "blocked", reason: "provider_policy_blocked" };
  }

  if (request.providerPolicy.requireLocalOnly && childContract.providerKind !== "local" && childContract.providerKind !== "internal") {
    return { decision: "blocked", reason: "provider_policy_blocked" };
  }

  if (childContract.providerKind === "internal") {
    if (childContract.childCapabilityId !== "internal-schema-validator") {
      return { decision: "blocked", reason: "provider_policy_blocked" };
    }
    return { decision: "allow", reason: null };
  }

  if (childContract.providerKind === "local") {
    return { decision: "allow", reason: null };
  }

  if (!request.providerPolicy.allowPaidProvider) {
    return { decision: "disabled", reason: "provider_disabled" };
  }

  if (request.providerPolicy.operatorApprovalRef === null) {
    return { decision: "review_required", reason: "provider_policy_blocked" };
  }

  return { decision: "allow", reason: null };
}
