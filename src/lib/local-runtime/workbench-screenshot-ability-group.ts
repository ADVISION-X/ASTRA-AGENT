import { createWorkbenchScreenshotAbilityGroup } from "../../capabilities/screenshot/workbench-screenshot-ability-group.js";

export const createWorkbenchRuntimeScreenshotAbilityGroup = (
  ...input: Parameters<typeof createWorkbenchScreenshotAbilityGroup>
) => createWorkbenchScreenshotAbilityGroup(...input);