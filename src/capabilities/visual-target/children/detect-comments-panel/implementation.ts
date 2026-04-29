import { VISUAL_TARGET_ABILITY_GROUP_ID, type VisualTargetChildCapability } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import { DetectCommentsPanelInputSchema } from "./schema.js";

export function createDetectCommentsPanelCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "detect-comments-panel",
    async execute(input, context) {
      const request = DetectCommentsPanelInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}