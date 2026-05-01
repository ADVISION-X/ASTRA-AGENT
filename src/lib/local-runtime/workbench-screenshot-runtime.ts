import { createWorkbenchRuntimeScreenshotAbilityGroup } from "./workbench-screenshot-ability-group.js";

type WorkbenchScreenshotRuntime = Parameters<typeof createWorkbenchRuntimeScreenshotAbilityGroup>[0];

export const createScreenshotRuntime = (runtime: WorkbenchScreenshotRuntime) => ({
  screenshotAbilityGroup: createWorkbenchRuntimeScreenshotAbilityGroup(runtime),
});