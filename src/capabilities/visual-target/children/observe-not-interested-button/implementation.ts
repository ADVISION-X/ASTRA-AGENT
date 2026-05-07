import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import type { VisualTargetChildCapability } from "../../runtime/visual-target-child-contract.js";
import { ObserveNotInterestedButtonInputSchema } from "./schema.js";

export function createObserveNotInterestedButtonCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "observe-not-interested-button",
    async execute(input, context) {
      const request = ObserveNotInterestedButtonInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}