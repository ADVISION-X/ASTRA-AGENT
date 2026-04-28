import type { AiAbilityInput, AiChildCapabilityId } from "../contract.js";

export const AI_ALLOWED_CALLERS = ["orchestration", "nerve-bus"] as const;

export const AI_FORBIDDEN_RESPONSIBILITIES = [
  "execute_platform_actions",
  "bypass_nerve_bus",
  "import_other_group_children",
  "implicit_paid_fallback",
] as const;

const LOCAL_AI_CHILD_CAPABILITY_IDS = ["local-vision-ai", "local-text-ai", "local-ocr-ai"] as const;
const ACTION_KEYWORDS = ["click", "scroll", "open_comments", "like", "like_or_save", "not_interested", "open_target_page"] as const;

function findActionKeyword(text: string): string | null {
  const normalizedReason = text.toLowerCase();
  for (const keyword of ACTION_KEYWORDS) {
    if (normalizedReason.includes(keyword)) {
      return keyword;
    }
  }

  return null;
}

function collectStringLeaves(value: unknown, sink: string[], visited: Set<object>): void {
  if (typeof value === "string") {
    sink.push(value);
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  if (visited.has(value)) {
    return;
  }

  visited.add(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringLeaves(item, sink, visited);
    }
    return;
  }

  for (const item of Object.values(value)) {
    collectStringLeaves(item, sink, visited);
  }
}

export function assertAiReadOnlyBoundary(reason: string): void {
  const keyword = findActionKeyword(reason);
  if (keyword !== null) {
    throw new Error(`AI Ability Group cannot execute platform actions directly: ${keyword}.`);
  }
}

export function isLocalAiChildCapabilityId(childCapabilityId: AiChildCapabilityId): boolean {
  return (LOCAL_AI_CHILD_CAPABILITY_IDS as readonly string[]).includes(childCapabilityId);
}

export function listAiReadOnlyBoundaryViolations(value: unknown): string[] {
  const strings: string[] = [];
  collectStringLeaves(value, strings, new Set<object>());
  const violations = new Set<string>();

  for (const text of strings) {
    const keyword = findActionKeyword(text);
    if (keyword !== null) {
      violations.add(`AI output contains forbidden action intent keyword: ${keyword}.`);
    }
  }

  return [...violations];
}

export function resolveAiPolicyViolationReasons(
  input: Pick<AiAbilityInput, "providerPolicy" | "dataPolicy" | "costPolicy">,
  childCapabilityId: AiChildCapabilityId,
): string[] {
  const reasons: string[] = [];

  if (!input.providerPolicy.providerAllowlist.includes(childCapabilityId)) {
    reasons.push(`providerAllowlist does not permit ${childCapabilityId}.`);
  }

  if (isLocalAiChildCapabilityId(childCapabilityId)) {
    return reasons;
  }

  if (input.providerPolicy.requireLocalOnly) {
    reasons.push("requireLocalOnly blocks non-local AI execution.");
  }
  if (!input.providerPolicy.allowPaidProvider) {
    reasons.push("allowPaidProvider=false blocks paid or future AI execution.");
  }
  if (input.providerPolicy.operatorApprovalRef === null) {
    reasons.push("operatorApprovalRef is required for paid or future AI execution.");
  }
  if (!input.dataPolicy.allowExternalTransmission) {
    reasons.push("allowExternalTransmission=false blocks paid or future AI execution.");
  }
  if (!input.dataPolicy.redactSensitiveData) {
    reasons.push("redactSensitiveData=false blocks paid or future AI execution.");
  }
  if (input.costPolicy.maxEstimatedCost === null) {
    reasons.push("maxEstimatedCost is required for paid or future AI execution.");
  }

  if (childCapabilityId === "future-api-ai") {
    reasons.push("future-api-ai remains disabled_by_policy until law unfreeze explicitly authorizes it.");
  } else {
    reasons.push(`${childCapabilityId} remains disabled_by_policy in the current phase.`);
  }

  return reasons;
}

export function hasExplicitPaidExecutionPolicy(input: Pick<AiAbilityInput, "providerPolicy" | "dataPolicy" | "costPolicy">): boolean {
  return input.providerPolicy.allowPaidProvider
    && input.providerPolicy.providerAllowlist.length > 0
    && input.providerPolicy.operatorApprovalRef !== null
    && input.dataPolicy.allowExternalTransmission
    && input.dataPolicy.redactSensitiveData
    && input.costPolicy.maxEstimatedCost !== null;
}

export function isPaidAiPolicyEnabled(input: Pick<AiAbilityInput, "providerPolicy" | "dataPolicy" | "costPolicy">): boolean {
  return hasExplicitPaidExecutionPolicy(input) && !input.providerPolicy.requireLocalOnly;
}