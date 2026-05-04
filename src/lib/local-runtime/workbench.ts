import { createCommanderConsoleAbilityGroup } from "../../capabilities/commander-console/index.js";
import { createWorkbenchRuntime } from "./workbench-runtime.js";
import type { GrassEyeWorkbenchOptions, WorkbenchRuntime } from "./workbench-contract.js";
import { createWorkbenchFacade } from "./workbench-facade.js";
import { createWorkbenchCommanderDependencies } from "./workbench-commander-dependencies.js";
import { createCommandTransport } from "./workbench-commander-command-transport.js";
import type { WorkbenchCommanderMissionSelectionState } from "./workbench-commander-mission-read-model.js";

export type { GrassEyePlatformTarget } from "./workbench-contract.js";

export class GrassEyeWorkbench {
  readonly commanderConsole;
  readonly nerveBusAbilityGroup;
  private readonly runtime: WorkbenchRuntime;

  constructor(options: GrassEyeWorkbenchOptions) {
    this.runtime = createWorkbenchRuntime(options);
    this.nerveBusAbilityGroup = this.runtime.nerveBusAbilityGroup;
    const missionSelectionState: WorkbenchCommanderMissionSelectionState = { lastMissionId: null };
    const commandTransport = createCommandTransport(
      this.runtime,
      missionSelectionState,
      (input) => this.nerveBusAbilityGroup.dispatchHumanCommand(input),
    );
    this.commanderConsole = createCommanderConsoleAbilityGroup({
      defaultOperatorRef: "commander-console:operator",
      commandTransport,
      ...createWorkbenchCommanderDependencies(this.runtime, missionSelectionState),
    });
    this.runtime.commanderConsole = this.commanderConsole;
  }

  createHandle() {
    return {
      commanderConsole: this.commanderConsole,
      ...createWorkbenchFacade(this.runtime),
    };
  }
}