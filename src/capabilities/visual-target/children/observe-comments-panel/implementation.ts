import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import type { VisualTargetChildCapability } from "../../runtime/visual-target-child-contract.js";
import { ObserveCommentsPanelInputSchema } from "./schema.js";

export function createObserveCommentsPanelCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "observe-comments-panel",
    async execute(input, context) {
      const request = ObserveCommentsPanelInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}