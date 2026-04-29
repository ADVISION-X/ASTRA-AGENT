import { VISUAL_TARGET_ABILITY_GROUP_ID, type VisualTargetChildCapability } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import { DetectLikeButtonInputSchema } from "./schema.js";

export function createDetectLikeButtonCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "detect-like-button",
    async execute(input, context) {
      const request = DetectLikeButtonInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}