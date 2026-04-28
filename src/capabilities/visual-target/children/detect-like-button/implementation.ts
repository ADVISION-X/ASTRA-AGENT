import { VISUAL_TARGET_ABILITY_GROUP_ID, type VisualTargetChildCapability } from "../../contract.js";
import { executeVisualTargetProfile } from "../../target-profiles.js";

export function createDetectLikeButtonCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "detect-like-button",
    execute(input, context) {
      return executeVisualTargetProfile({ childCapabilityId: "detect-like-button", request: input, context });
    },
  };
}