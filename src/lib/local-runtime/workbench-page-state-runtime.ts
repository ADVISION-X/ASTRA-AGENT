import { createWorkbenchPageStateAbilityGroup } from "../../capabilities/page-state/index.js";

export const createPageStateRuntime = () => ({
  pageStateAbilityGroup: createWorkbenchPageStateAbilityGroup(),
});