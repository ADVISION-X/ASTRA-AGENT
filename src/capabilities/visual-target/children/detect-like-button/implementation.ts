import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import type { VisualTargetChildCapability } from "../../runtime/visual-target-child-contract.js";
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