import { VISUAL_TARGET_ABILITY_GROUP_ID, type VisualTargetChildCapability } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import { DetectCommentsButtonInputSchema } from "./schema.js";

export function createDetectCommentsButtonCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "detect-comments-button",
    async execute(input, context) {
      const request = DetectCommentsButtonInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}