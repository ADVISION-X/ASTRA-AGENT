import {
  type VisualTargetAbilityGroup,
  type VisualTargetAbilityContext,
  type VisualTargetAbilityResult,
  type VisualTargetAbilityInput,
  VisualTargetAbilityInputSchema,
} from "./contract.js";
import { createVisualTargetCapabilityRegistry } from "./registry.js";

type CreateVisualTargetAbilityGroupInput = {
  defaultMinConfidence?: number;
  defaultAmbiguityConfidenceDelta?: number;
};

export function createVisualTargetAbilityGroup(input: CreateVisualTargetAbilityGroupInput = {}): VisualTargetAbilityGroup {
  const registry = createVisualTargetCapabilityRegistry();
  const context: VisualTargetAbilityContext = {
    defaultConfidencePolicy: { minConfidence: input.defaultMinConfidence ?? 0.72 },
    defaultSelectionPolicy: {
      strategy: "highestConfidence",
      ambiguityConfidenceDelta: input.defaultAmbiguityConfidenceDelta ?? 0.05,
    },
    defaultDataQualityPolicy: {
      requireCandidateRef: true,
      rejectContactSheetCoordinates: true,
      requireScaleMappingForAiInput: true,
    },
  };

  const executeById = async (inputValue: VisualTargetAbilityInput): Promise<VisualTargetAbilityResult> => {
    const normalizedInput = VisualTargetAbilityInputSchema.parse(inputValue);
    const capability = registry.get(normalizedInput.childCapabilityId);
    if (!capability) {
      throw new Error(`Visual target child capability is not registered for ${normalizedInput.childCapabilityId}`);
    }
    return capability.execute(normalizedInput, context);
  };

  return {
    listChildCapabilityIds() {
      return [...registry.keys()];
    },
    execute(inputValue) {
      return executeById(inputValue);
    },
  };
}