import type { WorkbenchFacade } from "./workbench-facade.js";
import type { GrassEyeWorkbench } from "./workbench.js";

export type GrassEyeWorkbenchHandle = Pick<GrassEyeWorkbench, "commanderConsole"> & WorkbenchFacade;