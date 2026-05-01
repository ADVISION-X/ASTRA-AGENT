import {
  createCommanderConsoleAbilityGroup,
  type CommanderConsoleAbilityGroup,
  type CommanderMissionDashboardView,
} from "../../capabilities/commander-console/index.js";
import { readAuditSummary } from "../../capabilities/commander-console/runtime/audit-summary-read-model.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import { createCapabilityHealthReadModel } from "./workbench-commander-health-read-model.js";
import { createCommandTransport } from "./workbench-commander-command-transport.js";
import { createForensicsReadModel } from "./workbench-commander-forensics-read-model.js";
import { createMissionReadModel } from "./workbench-commander-mission-read-model.js";
import { createRuntimeProofReadModel } from "./workbench-commander-runtime-proof-read-model.js";

export const createWorkbenchCommanderConsole = (
  runtime: WorkbenchRuntime,
): CommanderConsoleAbilityGroup =>
  createCommanderConsoleAbilityGroup({
    defaultOperatorRef: "commander-console:operator",
    commandTransport: createCommandTransport(runtime),
    missionReadModel: createMissionReadModel(runtime),
    forensicsReadModel: createForensicsReadModel(runtime),
    capabilityHealthReadModel: createCapabilityHealthReadModel(runtime),
    auditReadModel: { readAuditSummary },
    runtimeProofReadModel: createRuntimeProofReadModel(runtime),
  });

export const getCommanderConsoleSnapshot = async (
  runtime: WorkbenchRuntime,
): Promise<CommanderMissionDashboardView> => {
  const result = await runtime.commanderConsole.execute({ childCapabilityId: "show-mission-dashboard", operatorRef: "commander-console:shell", input: {} });
  if (result.status !== "success" || result.output === null) {
    throw new Error(result.failureReason ?? result.reviewRequiredReason ?? "Failed to read commander dashboard.");
  }
  return result.output as CommanderMissionDashboardView;
};