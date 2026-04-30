import { createWorkbenchRuntime } from "./workbench-runtime.js";
import type { GrassEyeWorkbenchOptions, WorkbenchRuntime } from "./workbench-contract.js";

export type { GrassEyePlatformTarget } from "./workbench-contract.js";

export class GrassEyeWorkbench {
  readonly commanderConsole;
  private readonly runtime: WorkbenchRuntime;

  constructor(options: GrassEyeWorkbenchOptions) {
    this.runtime = createWorkbenchRuntime(options);
    this.commanderConsole = this.runtime.commanderConsole;
  }

  async init(): Promise<void> {
    await this.runtime.init();
  }

  async getHealthReport() {
    return this.runtime.getHealthReport();
  }

  async getMissionReadinessReport() {
    return this.runtime.getMissionReadinessReport();
  }

  async getMissionStartPreflight(
    input: Parameters<WorkbenchRuntime["getMissionStartPreflight"]>[0],
  ) {
    return this.runtime.getMissionStartPreflight(input);
  }

  async recordCommanderDebugEvent(
    input: Parameters<WorkbenchRuntime["recordCommanderDebugEvent"]>[0],
  ) {
    await this.runtime.recordCommanderDebugEvent(input);
  }

  async getCommanderConsoleSnapshot() {
    return this.runtime.getCommanderConsoleSnapshot();
  }

  async listRuntimeDebugEvents(tail = 200) {
    return this.runtime.listRuntimeDebugEvents(tail);
  }

  async listRuntimeDebugActions(tail = 200) {
    return this.runtime.listRuntimeDebugActions(tail);
  }

  async getLocalAiRoleControls() {
    return this.runtime.getLocalAiRoleControls();
  }

  async setLocalAiRoleStartupState(
    input: Parameters<WorkbenchRuntime["setLocalAiRoleStartupState"]>[0],
  ) {
    return this.runtime.setLocalAiRoleStartupState(input);
  }

  async deleteCandidate(candidateId: string): Promise<void> {
    await this.runtime.deleteCandidate(candidateId);
  }

  async exportCandidateSummaries() {
    return this.runtime.exportCandidateSummaries();
  }

  getModeInfo() {
    return this.runtime.getModeInfo();
  }
}