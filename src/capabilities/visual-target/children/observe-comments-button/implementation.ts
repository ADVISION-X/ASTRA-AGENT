import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import type { VisualTargetChildCapability } from "../../runtime/visual-target-child-contract.js";
import { ObserveCommentsButtonInputSchema } from "./schema.js";

export function createObserveCommentsButtonCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "observe-comments-button",
    async execute(input, context) {
      const request = ObserveCommentsButtonInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}