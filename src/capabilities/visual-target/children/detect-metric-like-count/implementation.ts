import { VISUAL_TARGET_ABILITY_GROUP_ID, type VisualTargetChildCapability } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import { DetectMetricLikeCountInputSchema } from "./schema.js";

export function createDetectMetricLikeCountCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "detect-metric-like-count",
    async execute(input, context) {
      const request = DetectMetricLikeCountInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}