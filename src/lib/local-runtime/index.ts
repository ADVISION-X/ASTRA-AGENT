/**
 * index.ts — Public entry point for src/lib/local-runtime.
 *
 * Exports the workbench class, handle type, options type, and utility functions.
 */

export { GrassEyeWorkbench } from "./workbench.js";
export type { GrassEyeWorkbenchHandle } from "./workbench-handle.js";
export type { GrassEyeWorkbenchOptions, GrassEyePlatformTarget, RequestedPlatformId } from "./contract.js";
export { getDefaultLocalDataDir, getDefaultPhase04LocalDataDir } from "./default-data-dir.js";
export { createId } from "./ids.js";
