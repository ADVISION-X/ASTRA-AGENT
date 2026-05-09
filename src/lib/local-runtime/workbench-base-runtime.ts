import { getDefaultPhase04LocalDataDir } from "./default-data-dir.js";
import type { WorkbenchBaseRuntime, GrassEyeWorkbenchOptions } from "./workbench-contract.js";
import { createWorkbenchRuntimeAssemblies } from "./workbench-base-runtime-assemblies.js";

export const createWorkbenchBaseRuntime = (
  options: GrassEyeWorkbenchOptions,
): WorkbenchBaseRuntime => {
  const dataDir = options.dataDir ?? getDefaultPhase04LocalDataDir();
  const normalizedOptions = options.dataDir ? options : { ...options, dataDir };
  return createWorkbenchRuntimeAssemblies(normalizedOptions, dataDir);
};
