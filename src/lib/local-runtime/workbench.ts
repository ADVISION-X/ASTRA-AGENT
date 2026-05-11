/**
 * workbench.ts — GrassEyeWorkbench main class.
 *
 * Assembles all capability groups, nerve bus, orchestration, and commander console.
 * Provides a createHandle() method for the app layer.
 *
 * Does NOT contain: mission flow logic, AI routing, Forensics finalization,
 * Commander read-model universe, or map/binding chains.
 */

import {
  createNerveBusAbilityGroup,
  type NerveBusAbilityGroup,
} from "../../capabilities/nerve-bus/index.js";
import {
  createOrchestrationAbilityGroup,
  type OrchestrationAbilityGroup,
} from "../../capabilities/orchestration/index.js";
import {
  loadAppRunLimitSettings,
  saveAppRunLimitSettings,
  loadUserRequirementHistory,
  upsertUserRequirementHistory,
  deleteUserRequirementHistory,
  markUserRequirementHistoryReused,
  type UserRequirementHistoryUpsertInput,
} from "./settings.js";
import {
  getHealthReport,
  getMissionReadinessReport,
  getMissionStartPreflight,
  getModeInfo,
  type WorkbenchPreflightInput,
} from "./workbench-status.js";
import {
  createWorkbenchAssembly,
  type WorkbenchAssembly,
} from "./workbench-assembly.js";
import {
  createWorkbenchNerveBusHandlerPort,
} from "./workbench-nerve-bus-dispatcher.js";
import {
  createWorkbenchCommanderConsole,
  getCommanderConsoleSnapshot,
  type WorkbenchCommanderMissionDashboardView,
} from "./workbench-commander-console.js";
import type { GrassEyeWorkbenchOptions } from "./contract.js";
import type { GrassEyeWorkbenchHandle } from "./workbench-handle.js";

// ─── Active Capability Group IDs ───────────────────────────────────────────

const ACTIVE_CAPABILITY_GROUP_IDS = [
  "ai",
  "open",
  "screenshot",
  "visual-target",
  "geometry-guard",
  "mouse-click",
  "mouse-scroll",
  "text-input",
  "forensics-persistence",
  "orchestration",
  "nerve-bus",
  "commander-console",
] as const;

// ─── GrassEyeWorkbench ───────────────────────────────────────────────────────

export class GrassEyeWorkbench {
  private readonly _assembly: WorkbenchAssembly;
  private readonly _nerveBus: NerveBusAbilityGroup;
  private readonly _orchestration: OrchestrationAbilityGroup;
  private readonly _commanderConsole: ReturnType<typeof createWorkbenchCommanderConsole>;

  constructor(options: GrassEyeWorkbenchOptions) {
    this._assembly = createWorkbenchAssembly(options);

    // Bootstrap: dispatcher holds a late-bound ref to orchestration
    const orchestrationRef: { instance: OrchestrationAbilityGroup | null } = { instance: null };

    const handlerPort = createWorkbenchNerveBusHandlerPort({
      ...this._assembly,
      getOrchestration: () => {
        if (!orchestrationRef.instance) throw new Error("Orchestration not yet initialized");
        return orchestrationRef.instance;
      },
    });

    this._nerveBus = createNerveBusAbilityGroup({ handlerPort });

    this._orchestration = createOrchestrationAbilityGroup({
      nerveBus: this._nerveBus,
      forensics: this._assembly.forensicsPersistenceAbilityGroup,
      screenshot: this._assembly.screenshotAbilityGroup,
      ai: this._assembly.aiAbilityGroup,
      geometryGuard: this._assembly.geometryGuardAbilityGroup,
    });
    orchestrationRef.instance = this._orchestration;

    this._commanderConsole = createWorkbenchCommanderConsole({
      nerveBus: this._nerveBus,
      getOrchestration: () => this._orchestration,
    });
  }

  // ─── Init ────────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    // Data directory is created on first write by the storage layer.
    // No additional initialization is required for the minimal runtime shell.
  }

  // ─── Handle ──────────────────────────────────────────────────────────────

  createHandle(): GrassEyeWorkbenchHandle {
    const self = this;
    const { _assembly, _orchestration, _commanderConsole } = self;
    const dataDir = _assembly.dataDir;

    return {
      commanderConsole: _commanderConsole,

      async init() {
        return self.init();
      },

      async getHealthReport() {
        return getHealthReport(_assembly);
      },

      async getMissionReadinessReport() {
        return getMissionReadinessReport(_assembly, _assembly.options);
      },

      async getMissionStartPreflight(input: WorkbenchPreflightInput) {
        return getMissionStartPreflight(_assembly, _assembly.options, input);
      },

      async getCommanderConsoleSnapshot(): Promise<WorkbenchCommanderMissionDashboardView> {
        return getCommanderConsoleSnapshot({
          commanderConsole: _commanderConsole,
          getOrchestration: () => _orchestration,
          capabilityGroupIds: [...ACTIVE_CAPABILITY_GROUP_IDS],
        });
      },

      async getAppRunLimitSettings() {
        return loadAppRunLimitSettings(dataDir);
      },

      async saveAppRunLimitSettings(input) {
        return saveAppRunLimitSettings(dataDir, input);
      },

      getDataDir() {
        return dataDir;
      },

      async getUserRequirementHistory(limit?: number) {
        return loadUserRequirementHistory(dataDir, limit);
      },

      async upsertUserRequirementHistory(input: UserRequirementHistoryUpsertInput) {
        return upsertUserRequirementHistory(dataDir, input);
      },

      async deleteUserRequirementHistory(id: string) {
        return deleteUserRequirementHistory(dataDir, id);
      },

      async reuseUserRequirementHistory(id: string) {
        return markUserRequirementHistoryReused(dataDir, id);
      },

      getModeInfo() {
        return getModeInfo(_assembly.options);
      },
    };
  }
}
