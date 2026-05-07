import type { WorkbenchRuntime } from "./workbench-contract.js";

export type WorkbenchFacade = Pick<
  WorkbenchRuntime,
  | "init"
  | "getHealthReport"
  | "getMissionReadinessReport"
  | "getMissionStartPreflight"
  | "recordCommanderDebugEvent"
  | "getCommanderConsoleSnapshot"
  | "listRuntimeDebugEvents"
  | "listRuntimeDebugActions"
  | "getLocalAiRoleControls"
  | "setLocalAiRoleStartupState"
  | "deleteCandidate"
  | "exportCandidateSummaries"
  | "getMapLabSnapshot"
  | "saveMapLabProviderConfig"
  | "generateMapLabDraft"
  | "passMapLabAutomationGate"
  | "activateMapLabDraft"
  | "getModeInfo"
>;

export const createWorkbenchFacade = (runtime: WorkbenchRuntime): WorkbenchFacade => ({
  init: () => runtime.init(),
  getHealthReport: () => runtime.getHealthReport(),
  getMissionReadinessReport: () => runtime.getMissionReadinessReport(),
  getMissionStartPreflight: (input) => runtime.getMissionStartPreflight(input),
  recordCommanderDebugEvent: (input) => runtime.recordCommanderDebugEvent(input),
  getCommanderConsoleSnapshot: () => runtime.getCommanderConsoleSnapshot(),
  listRuntimeDebugEvents: (tail = 200) => runtime.listRuntimeDebugEvents(tail),
  listRuntimeDebugActions: (tail = 200) => runtime.listRuntimeDebugActions(tail),
  getLocalAiRoleControls: () => runtime.getLocalAiRoleControls(),
  setLocalAiRoleStartupState: (input) => runtime.setLocalAiRoleStartupState(input),
  deleteCandidate: (candidateId) => runtime.deleteCandidate(candidateId),
  exportCandidateSummaries: () => runtime.exportCandidateSummaries(),
  getMapLabSnapshot: () => runtime.getMapLabSnapshot(),
  saveMapLabProviderConfig: (input) => runtime.saveMapLabProviderConfig(input),
  generateMapLabDraft: (input) => runtime.generateMapLabDraft(input),
  passMapLabAutomationGate: (input) => runtime.passMapLabAutomationGate(input),
  activateMapLabDraft: (input) => runtime.activateMapLabDraft(input),
  getModeInfo: () => runtime.getModeInfo(),
});
