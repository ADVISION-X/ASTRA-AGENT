import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import type { VisualTargetChildCapability } from "../../runtime/visual-target-child-contract.js";
import { DetectCloseCommentsButtonInputSchema } from "./schema.js";

export function createDetectCloseCommentsButtonCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "detect-close-comments-button",
    async execute(input, context) {
      const request = DetectCloseCommentsButtonInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}