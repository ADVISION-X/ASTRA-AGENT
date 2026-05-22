/**
 * workbench-launch-contract.ts — Server launch helper.
 *
 * Provides the `createGrassEyeWorkbenchHandle` factory used by server.ts.
 * This is a thin convenience wrapper over GrassEyeWorkbench.
 */

import { GrassEyeWorkbench } from "./workbench.js";
import type { GrassEyeWorkbenchOptions, GrassEyePlatformTarget } from "./contract.js";
import type { GrassEyeWorkbenchHandle } from "./workbench-handle.js";

export type { GrassEyePlatformTarget };

export function createGrassEyeWorkbenchHandle(options: GrassEyeWorkbenchOptions): GrassEyeWorkbenchHandle {
  const workbench = new GrassEyeWorkbench(options);
  return workbench.createHandle();
}
