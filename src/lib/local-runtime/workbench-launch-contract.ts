import { getDefaultPhase04LocalDataDir as getDefaultPhase04LocalDataDirInternal } from "./default-data-dir.js";
import { createGrassEyeWorkbenchHandle as createGrassEyeWorkbenchHandleInternal } from "./workbench-handle-factory.js";
import type { GrassEyeWorkbenchHandle } from "./workbench-handle.js";
import type { GrassEyePlatformTarget as WorkbenchPlatformTarget, GrassEyeWorkbenchOptions } from "./workbench-contract.js";

export type GrassEyePlatformTarget = WorkbenchPlatformTarget;

export const getDefaultPhase04LocalDataDir = (platform = process.platform): string => {
  return getDefaultPhase04LocalDataDirInternal(platform);
};

export const createGrassEyeWorkbenchHandle = (
  options: GrassEyeWorkbenchOptions,
): GrassEyeWorkbenchHandle => {
  return createGrassEyeWorkbenchHandleInternal(options);
};