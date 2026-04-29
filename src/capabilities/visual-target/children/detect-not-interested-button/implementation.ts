import { VISUAL_TARGET_ABILITY_GROUP_ID, type VisualTargetChildCapability } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import { DetectNotInterestedButtonInputSchema } from "./schema.js";

export function createDetectNotInterestedButtonCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "detect-not-interested-button",
    async execute(input, context) {
      const request = DetectNotInterestedButtonInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}