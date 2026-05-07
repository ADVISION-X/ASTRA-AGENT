import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import type { VisualTargetChildCapability } from "../../runtime/visual-target-child-contract.js";
import { ObserveMetricCommentCountInputSchema } from "./schema.js";

export function createObserveMetricCommentCountCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "observe-metric-comment-count",
    async execute(input, context) {
      const request = ObserveMetricCommentCountInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}