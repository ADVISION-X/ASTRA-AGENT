import { VISUAL_TARGET_ABILITY_GROUP_ID, type VisualTargetChildCapability } from "../../contract.js";
import { executeVisualTargetProfile } from "../../target-profiles.js";

export function createDetectNotInterestedButtonCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "detect-not-interested-button",
    execute(input, context) {
      return executeVisualTargetProfile({ childCapabilityId: "detect-not-interested-button", request: input, context });
    },
  };
}