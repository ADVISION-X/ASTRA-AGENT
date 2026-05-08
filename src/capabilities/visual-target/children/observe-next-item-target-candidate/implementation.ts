import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import type { VisualTargetChildCapability } from "../../runtime/visual-target-child-contract.js";
import { ObserveNextItemTargetCandidateInputSchema } from "./schema.js";

export function createObserveNextItemTargetCandidateCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "observe-next-item-target-candidate",
    async execute(input, context) {
      const request = ObserveNextItemTargetCandidateInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import type { VisualTargetChildCapability } from "../../runtime/visual-target-child-contract.js";
import { ObserveNextItemTargetCandidateInputSchema } from "./schema.js";

export function createObserveNextItemTargetCandidateCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "observe-next-item-target-candidate",
    async execute(input, context) {
      const request = ObserveNextItemTargetCandidateInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}