import type { AiAbilityInput, AiChildCapabilityId, AiPromptContract } from "../contract.js";
import { listAiReadOnlyBoundaryViolations, resolveAiPolicyViolationReasons } from "../shared/ai-policy.js";

const POLICY_DISABLED_CHILD_CAPABILITIES = new Set<AiChildCapabilityId>([
  "paid-vision-ai",
  "paid-analysis-ai",
  "future-api-ai",
]);

export function collectAiRuntimePolicyViolations(input: {
  request: AiAbilityInput;
  childCapabilityId: AiChildCapabilityId;
  promptContract: AiPromptContract;
}): string[] {
  return [
    ...resolveAiPolicyViolationReasons(input.request, input.childCapabilityId),
    ...listAiReadOnlyBoundaryViolations(input.promptContract.purpose),
  ];
}

export function collectAiOutputBoundaryViolations(output: unknown): string[] {
  return listAiReadOnlyBoundaryViolations(output);
}

export function isPolicyDisabledAiChild(childCapabilityId: AiChildCapabilityId): boolean {
  return POLICY_DISABLED_CHILD_CAPABILITIES.has(childCapabilityId);
}