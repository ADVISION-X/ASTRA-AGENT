import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import type { VisualTargetChildCapability } from "../../runtime/visual-target-child-contract.js";
import { DetectSaveButtonInputSchema } from "./schema.js";

export function createDetectSaveButtonCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "detect-save-button",
    async execute(input, context) {
      const request = DetectSaveButtonInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}