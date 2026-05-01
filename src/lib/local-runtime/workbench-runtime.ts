import type { WorkbenchRuntime, GrassEyeWorkbenchOptions } from "./workbench-contract.js";
import { createWorkbenchBaseRuntime } from "./workbench-base-runtime.js";
import { createWorkbenchCommanderConsole, getCommanderConsoleSnapshot } from "./workbench-commander-console.js";
import { recordCommanderDebugEvent } from "./workbench-commander-debug.js";
import { createWorkbenchNerveBus } from "./workbench-nerve-bus.js";
import { createWorkbenchOrchestration } from "./workbench-orchestration.js";
import { getWorkbenchLocalAiRoleControls, setWorkbenchLocalAiRoleStartupState } from "./workbench-ai-role-controls.js";
import { getHealthReport, getMissionReadinessReport, getMissionStartPreflight, getModeInfo } from "./workbench-status.js";

export const createWorkbenchRuntime = (
  options: GrassEyeWorkbenchOptions,
): WorkbenchRuntime => {
  const baseRuntime = createWorkbenchBaseRuntime(options);
  const runtime = baseRuntime as WorkbenchRuntime;
  runtime.nerveBusAbilityGroup = createWorkbenchNerveBus(runtime);
  runtime.orchestrationAbilityGroup = createWorkbenchOrchestration(runtime);
  runtime.commanderConsole = createWorkbenchCommanderConsole(runtime);
  runtime.init = () => runtime.evidenceStore.init();
  runtime.getHealthReport = () => getHealthReport(runtime);
  runtime.getMissionReadinessReport = () => getMissionReadinessReport(runtime);
  runtime.getMissionStartPreflight = (input) => getMissionStartPreflight(runtime, input);
  runtime.recordCommanderDebugEvent = (input) => recordCommanderDebugEvent(runtime, input);
  runtime.getCommanderConsoleSnapshot = () => getCommanderConsoleSnapshot(runtime);
  runtime.listRuntimeDebugEvents = (tail = 200) => runtime.evidenceStore.listStructuredRuntimeEvents(tail);
  runtime.listRuntimeDebugActions = (tail = 200) => runtime.evidenceStore.listStructuredActionLogs(tail);
  runtime.getLocalAiRoleControls = () => getWorkbenchLocalAiRoleControls();
  runtime.setLocalAiRoleStartupState = (input) => setWorkbenchLocalAiRoleStartupState(input);
  runtime.deleteCandidate = (candidateId) => runtime.evidenceStore.deleteCandidate(candidateId);
  runtime.exportCandidateSummaries = () => runtime.evidenceStore.exportCandidateSummaries();
  runtime.getModeInfo = () => getModeInfo(runtime);
  return runtime;
};