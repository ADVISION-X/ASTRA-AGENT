import { VISUAL_TARGET_ABILITY_GROUP_ID, type VisualTargetChildCapability } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import { DetectNextVideoRegionInputSchema } from "./schema.js";

export function createDetectNextVideoRegionCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "detect-next-video-region",
    async execute(input, context) {
      const request = DetectNextVideoRegionInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}