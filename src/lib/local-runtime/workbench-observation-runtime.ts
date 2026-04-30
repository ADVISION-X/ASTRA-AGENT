import type { WorkbenchBaseRuntime } from "./workbench-contract.js";
import { createPageStateRuntime } from "./workbench-page-state-runtime.js";
import { createPostActionRuntime } from "./workbench-post-action-runtime.js";
import { createScreenshotRuntime } from "./workbench-screenshot-runtime.js";
import { createVisualRuntime } from "./workbench-visual-runtime.js";

export const createObservationRuntimes = (runtime: Pick<WorkbenchBaseRuntime, "browserController" | "evidenceStore">) => ({
  ...createPageStateRuntime(),
  ...createPostActionRuntime(),
  ...createScreenshotRuntime(runtime),
  ...createVisualRuntime(),
});