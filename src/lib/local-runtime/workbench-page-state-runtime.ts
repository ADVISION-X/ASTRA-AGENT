import { createPageStateAbilityGroup } from "../../capabilities/page-state/ability-group.js";
import { createDefaultPageStateRuntimeContext } from "../../capabilities/page-state/runtime/page-state-runtime-context.js";

export const createPageStateRuntime = () => ({
  pageStateAbilityGroup: createPageStateAbilityGroup(createDefaultPageStateRuntimeContext()),
});