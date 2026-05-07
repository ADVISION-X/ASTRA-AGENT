import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import type { VisualTargetChildCapability } from "../../runtime/visual-target-child-contract.js";
import { ObserveCloseCommentsButtonInputSchema } from "./schema.js";

export function createObserveCloseCommentsButtonCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "observe-close-comments-button",
    async execute(input, context) {
      const request = ObserveCloseCommentsButtonInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}