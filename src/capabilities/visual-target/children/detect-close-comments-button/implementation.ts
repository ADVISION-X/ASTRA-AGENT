import { VISUAL_TARGET_ABILITY_GROUP_ID, type VisualTargetChildCapability } from "../../contract.js";
import { executeVisualTargetProfile } from "../../target-profiles.js";

export function createDetectCloseCommentsButtonCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "detect-close-comments-button",
    execute(input, context) {
      return executeVisualTargetProfile({ childCapabilityId: "detect-close-comments-button", request: input, context });
    },
  };
}