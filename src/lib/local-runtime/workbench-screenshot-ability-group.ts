import { createWorkbenchScreenshotAbilityGroup } from "../../capabilities/screenshot/index.js";

export const createWorkbenchRuntimeScreenshotAbilityGroup = (
  ...input: Parameters<typeof createWorkbenchScreenshotAbilityGroup>
) => createWorkbenchScreenshotAbilityGroup(...input);