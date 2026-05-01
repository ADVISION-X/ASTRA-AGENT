import type { GrassEyeWorkbenchOptions } from "./workbench-contract.js";
import type { GrassEyeWorkbenchHandle } from "./workbench-handle.js";
import { GrassEyeWorkbench } from "./workbench.js";

export const createGrassEyeWorkbenchHandle = (
  options: GrassEyeWorkbenchOptions,
): GrassEyeWorkbenchHandle => {
  return new GrassEyeWorkbench(options).createHandle();
};