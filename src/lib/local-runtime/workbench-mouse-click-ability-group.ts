import { createMouseClickAbilityGroupWithPrimitivePort } from "../../capabilities/mouse-click/index.js";

export const createWorkbenchMouseClickAbilityGroup = (
  ...input: Parameters<typeof createMouseClickAbilityGroupWithPrimitivePort>
) => createMouseClickAbilityGroupWithPrimitivePort(...input);