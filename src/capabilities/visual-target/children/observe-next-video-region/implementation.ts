import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import type { VisualTargetChildCapability } from "../../runtime/visual-target-child-contract.js";
import { ObserveNextVideoRegionInputSchema } from "./schema.js";

export function createObserveNextVideoRegionCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "observe-next-video-region",
    async execute(input, context) {
      const request = ObserveNextVideoRegionInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}