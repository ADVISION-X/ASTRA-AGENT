import { createPageStateAbilityGroup } from "./ability-group.js";
import { createDefaultPageStateRuntimeContext } from "./runtime/page-state-runtime-context.js";

export const createWorkbenchPageStateAbilityGroup = () =>
	createPageStateAbilityGroup(createDefaultPageStateRuntimeContext());