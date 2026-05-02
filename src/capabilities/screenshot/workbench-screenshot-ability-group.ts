import { createWorkbenchScreenshotAbilityGroup as createRuntimeWorkbenchScreenshotAbilityGroup } from "./runtime/workbench-screenshot-ability-group.js";

type WorkbenchScreenshotRuntime = Parameters<typeof createRuntimeWorkbenchScreenshotAbilityGroup>[0];

export const createWorkbenchScreenshotAbilityGroup = (runtime: WorkbenchScreenshotRuntime) =>
  createRuntimeWorkbenchScreenshotAbilityGroup(runtime);