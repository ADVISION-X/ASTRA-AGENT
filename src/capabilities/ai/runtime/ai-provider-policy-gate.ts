import type { AiChildContract, ParsedAiAbilityInput } from "../contract.js";

function isDisabledProvider(request: ParsedAiAbilityInput, childContract: AiChildContract): boolean {
  return childContract.implementationStatus === "disabled_by_policy"
    || childContract.providerKind === "future"
    || (!request.providerPolicy.allowPaidProvider && childContract.providerKind === "paid");
}

function isLocalOrInternalProvider(childContract: AiChildContract): boolean {
  return childContract.providerKind === "local" || childContract.providerKind === "internal";
}

function resolveInternalProviderDecision(childContract: AiChildContract): { decision: "allow" | "blocked"; reason: string | null } {
  if (childContract.childCapabilityId !== "internal-schema-validator") {
    return { decision: "blocked", reason: "provider_policy_blocked" };
  }
  return { decision: "allow", reason: null };
}

function hasAllowedProviderId(request: ParsedAiAbilityInput, childContract: AiChildContract): boolean {
  return request.providerPolicy.providerAllowlist.includes(childContract.childCapabilityId);
}

function requiresOperatorReview(request: ParsedAiAbilityInput, childContract: AiChildContract): boolean {
  return childContract.providerKind === "paid" && request.providerPolicy.operatorApprovalRef === null;
}

function missingProviderConfigRef(request: ParsedAiAbilityInput, childContract: AiChildContract): boolean {
  return childContract.providerKind === "paid" && request.providerPolicy.providerConfigRef === null;
}

function missingSecretRef(request: ParsedAiAbilityInput, childContract: AiChildContract): boolean {
  return childContract.providerKind === "paid" && request.providerPolicy.secretRef === null;
}

const PAID_PROVIDER_REVIEW_RULES = [
  [missingProviderConfigRef, "provider_config_missing"],
  [missingSecretRef, "provider_secret_missing"],
  [requiresOperatorReview, "operator_approval_missing"],
] as const;

function resolvePaidProviderDecision(request: ParsedAiAbilityInput, childContract: AiChildContract) {
  for (const [matchesRule, reason] of PAID_PROVIDER_REVIEW_RULES) {
    if (matchesRule(request, childContract)) {
      return { decision: "review_required", reason } as const;
    }
  }

  return { decision: "allow", reason: null } as const;
}

function resolveEnabledProviderDecision(request: ParsedAiAbilityInput, childContract: AiChildContract) {
  if (childContract.providerKind === "internal") {
    return resolveInternalProviderDecision(childContract);
  }
  if (childContract.providerKind === "local") {
    return { decision: "allow", reason: null } as const;
  }

  return resolvePaidProviderDecision(request, childContract);
}

export function evaluateAiProviderPolicy(request: ParsedAiAbilityInput, childContract: AiChildContract): { decision: "allow" | "review_required" | "blocked" | "disabled"; reason: string | null } {
  if (isDisabledProvider(request, childContract)) {
    return { decision: "disabled", reason: "provider_disabled" };
  }

  if (!hasAllowedProviderId(request, childContract)) {
    return { decision: "blocked", reason: "provider_policy_blocked" };
  }

  if (request.providerPolicy.requireLocalOnly && !isLocalOrInternalProvider(childContract)) {
    return { decision: "blocked", reason: "provider_policy_blocked" };
  }

  return resolveEnabledProviderDecision(request, childContract);
}
