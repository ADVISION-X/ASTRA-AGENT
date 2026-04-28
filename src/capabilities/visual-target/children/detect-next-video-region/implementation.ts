import { VISUAL_TARGET_ABILITY_GROUP_ID, type VisualTargetChildCapability } from "../../contract.js";
import { executeVisualTargetProfile } from "../../target-profiles.js";

export function createDetectNextVideoRegionCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "detect-next-video-region",
    execute(input, context) {
      return executeVisualTargetProfile({ childCapabilityId: "detect-next-video-region", request: input, context });
    },
  };
}