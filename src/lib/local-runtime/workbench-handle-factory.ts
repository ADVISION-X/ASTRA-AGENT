import type { GrassEyeWorkbenchOptions } from "./workbench-contract.js";
import type { GrassEyeWorkbenchHandle } from "./workbench-handle.js";
import { createWorkbenchFacade } from "./workbench-facade.js";
import { createWorkbenchRuntime } from "./workbench-runtime.js";

export const createGrassEyeWorkbenchHandle = (
  options: GrassEyeWorkbenchOptions,
): GrassEyeWorkbenchHandle => {
  const runtime = createWorkbenchRuntime(options);
  return {
    commanderConsole: runtime.commanderConsole,
    ...createWorkbenchFacade(runtime),
  };
};