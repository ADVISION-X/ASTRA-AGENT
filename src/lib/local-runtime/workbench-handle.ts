/**
 * workbench-handle.ts — GrassEyeWorkbenchHandle type.
 *
 * The handle exposes the CommanderConsole ability group and all WorkbenchFacade methods.
 * This is the public surface used by the app layer.
 */

import type { CommanderConsoleAbilityGroup } from "../../capabilities/commander-console/index.js";
import type { WorkbenchFacade } from "./workbench-facade.js";

export type GrassEyeWorkbenchHandle = {
  commanderConsole: CommanderConsoleAbilityGroup;
} & WorkbenchFacade;
