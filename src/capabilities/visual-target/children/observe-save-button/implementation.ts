import { VISUAL_TARGET_ABILITY_GROUP_ID } from "../../contract.js";
import { executeVisualTarget } from "../../runtime/visual-target-executor.js";
import type { VisualTargetChildCapability } from "../../runtime/visual-target-child-contract.js";
import { ObserveSaveButtonInputSchema } from "./schema.js";

export function createObserveSaveButtonCapability(): VisualTargetChildCapability {
  return {
    abilityGroupId: VISUAL_TARGET_ABILITY_GROUP_ID,
    childCapabilityId: "observe-save-button",
    async execute(input, context) {
      const request = ObserveSaveButtonInputSchema.parse(input);
      return executeVisualTarget({ request, context });
    },
  };
}