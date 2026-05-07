import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import type { VisualTargetChildCapability } from "../../runtime/visual-target-child-contract.js";
import { ObserveMetricLikeCountInputSchema } from "./schema.js";

export function createObserveMetricLikeCountCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "observe-metric-like-count",
    async execute(input, context) {
      const request = ObserveMetricLikeCountInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}