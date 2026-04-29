import type { AiChildContract, AiPromptContract, ParsedAiAbilityInput } from "../contract.js";
import { AiRuntimeExecutionOutputSchema } from "../schema.js";

export function buildAiDisabledProviderOutput(request: ParsedAiAbilityInput, childContract: AiChildContract, promptContract: AiPromptContract) {
  return AiRuntimeExecutionOutputSchema.parse({
    modelProvider: childContract.providerKind,
    modelName: "disabled",
    modelRole: promptContract.modelRole,
    runtime: "policy-disabled",
    implementationStatus: childContract.implementationStatus,
    createdAt: null,
    confidence: null,
    costEstimate: null,
    output: {
      disabled: true,
      reason: `Provider ${childContract.childCapabilityId} is disabled.`,
    },
    rawOutputRef: null,
  });
}
