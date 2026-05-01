import { createWorkbenchRuntime } from "./workbench-runtime.js";
import type { GrassEyeWorkbenchOptions, WorkbenchRuntime } from "./workbench-contract.js";
import { createWorkbenchFacade, type WorkbenchFacade } from "./workbench-facade.js";

export type { GrassEyePlatformTarget } from "./workbench-contract.js";

export interface GrassEyeWorkbench extends WorkbenchFacade {}

export class GrassEyeWorkbench {
  readonly commanderConsole;
  private readonly runtime: WorkbenchRuntime;

  constructor(options: GrassEyeWorkbenchOptions) {
    this.runtime = createWorkbenchRuntime(options);
    this.commanderConsole = this.runtime.commanderConsole;
    Object.assign(this, createWorkbenchFacade(this.runtime));
  }
}