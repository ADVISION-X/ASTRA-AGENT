import { VISUAL_TARGET_ABILITY_GROUP_ID, type VisualTargetChildCapability } from "../../contract.js";
import { executeVisualTargetProfile } from "../../target-profiles.js";

export function createDetectCommentsPanelCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "detect-comments-panel",
    execute(input, context) {
      return executeVisualTargetProfile({ childCapabilityId: "detect-comments-panel", request: input, context });
    },
  };
}