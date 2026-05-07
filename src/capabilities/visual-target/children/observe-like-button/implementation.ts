import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import type { VisualTargetChildCapability } from "../../runtime/visual-target-child-contract.js";
import { ObserveLikeButtonInputSchema } from "./schema.js";

export function createObserveLikeButtonCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "observe-like-button",
    async execute(input, context) {
      const request = ObserveLikeButtonInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}