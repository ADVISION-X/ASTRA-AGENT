import { createMouseScrollAbilityGroupWithPrimitivePort } from "../../capabilities/mouse-scroll/index.js";

export const createWorkbenchMouseScrollAbilityGroup = (
  ...input: Parameters<typeof createMouseScrollAbilityGroupWithPrimitivePort>
) => createMouseScrollAbilityGroupWithPrimitivePort(...input);