import { createWorkbenchPageStateAbilityGroup } from "../../capabilities/page-state/workbench-ability-group.js";

export const createPageStateRuntime = () => ({
  pageStateAbilityGroup: createWorkbenchPageStateAbilityGroup(),
});