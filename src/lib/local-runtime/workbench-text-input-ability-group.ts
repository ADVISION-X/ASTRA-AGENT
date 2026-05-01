import { createTextInputAbilityGroupWithPorts } from "../../capabilities/text-input/index.js";

export const createWorkbenchTextInputAbilityGroup = (
  ...input: Parameters<typeof createTextInputAbilityGroupWithPorts>
) => createTextInputAbilityGroupWithPorts(...input);