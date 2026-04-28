import { VISUAL_TARGET_ABILITY_GROUP_ID, type VisualTargetChildCapability } from "../../contract.js";
import { executeVisualTargetProfile } from "../../target-profiles.js";

export function createDetectMetricCommentCountCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "detect-metric-comment-count",
    execute(input, context) {
      return executeVisualTargetProfile({ childCapabilityId: "detect-metric-comment-count", request: input, context });
    },
  };
}