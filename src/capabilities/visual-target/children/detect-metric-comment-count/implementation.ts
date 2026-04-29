import { VISUAL_TARGET_ABILITY_GROUP_ID, type VisualTargetChildCapability } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import { DetectMetricCommentCountInputSchema } from "./schema.js";

export function createDetectMetricCommentCountCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "detect-metric-comment-count",
    async execute(input, context) {
      const request = DetectMetricCommentCountInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}