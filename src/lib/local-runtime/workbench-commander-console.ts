import {
  createCommanderConsoleAbilityGroup,
  type CommanderConsoleAbilityGroup,
} from "../../capabilities/commander-console/index.js";
import type { NerveBusAbilityGroup } from "../../capabilities/nerve-bus/index.js";
import type { OrchestrationAbilityGroup } from "../../capabilities/orchestration/index.js";
import { createNerveBusCommandTransportPort } from "./workbench-commander-transport.js";
import { createGetMissionStatus } from "./workbench-commander-status.js";
import { getCommanderConsoleSnapshot } from "./workbench-commander-snapshot.js";
import type { WorkbenchCommanderMissionDashboardView } from "./workbench-commander-snapshot-types.js";

type GetOrchestration = () => OrchestrationAbilityGroup;

export type { WorkbenchCommanderMissionDashboardView };
export { getCommanderConsoleSnapshot };

export function createWorkbenchCommanderConsole(input: {
  nerveBus: NerveBusAbilityGroup;
  getOrchestration: GetOrchestration;
  operatorRef?: string;
}): CommanderConsoleAbilityGroup {
  return createCommanderConsoleAbilityGroup({
    defaultOperatorRef: input.operatorRef ?? "commander-console:workbench",
    commandTransport: createNerveBusCommandTransportPort(input.nerveBus),
    getMissionStatus: createGetMissionStatus(input.getOrchestration),
  });
}
