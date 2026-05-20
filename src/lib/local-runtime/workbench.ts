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
  loadOnlineAiProviderPublicStatus,
  saveOnlineAiProviderConfig,
} from "../online-ai/index.js";
import {
  getHealthReport,
  getMissionReadinessReport,
  getMissionStartPreflight,
  getModeInfo,
} from "./workbench-status.js";
import type { WorkbenchPreflightInput } from "./workbench-status-types.js";
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
import {
  getLatestAmazonInvoiceUploadTaskForInvoice,
  getAmazonInvoiceUploadTaskStatus,
  openAmazonInvoiceAdminPage,
  resumeAmazonInvoiceUploadTask,
  startAmazonInvoiceUploadTask,
  startAmazonInvoiceUploadMission,
} from "../../plugins/amazon-invoice-upload/index.js";

// ─── Active Capability Group IDs ───────────────────────────────────────────

const ACTIVE_CAPABILITY_GROUP_IDS = [
  "ai",
  "open",
  "screenshot",
  "geometry-guard",
  "mouse-click",
  "mouse-scroll",
  "text-input",
  "forensics-persistence",
  "orchestration",
  "nerve-bus",
  "commander-console",
] as const;

type CommanderConsoleSurface = ReturnType<typeof createWorkbenchCommanderConsole>;

type WorkbenchCore = {
  assembly: WorkbenchAssembly;
  nerveBus: NerveBusAbilityGroup;
  orchestration: OrchestrationAbilityGroup;
  commanderConsole: CommanderConsoleSurface;
};

type BuildWorkbenchHandleInput = {
  init: () => Promise<void>;
  assembly: WorkbenchAssembly;
  orchestration: OrchestrationAbilityGroup;
  commanderConsole: CommanderConsoleSurface;
};

const createWorkbenchOrchestration = (
  assembly: WorkbenchAssembly,
  nerveBus: NerveBusAbilityGroup,
): OrchestrationAbilityGroup =>
  createOrchestrationAbilityGroup({
    nerveBus,
    forensics: assembly.forensicsPersistenceAbilityGroup,
    screenshot: assembly.screenshotAbilityGroup,
    ai: assembly.aiAbilityGroup,
    geometryGuard: assembly.geometryGuardAbilityGroup,
    open: assembly.openAbilityGroup,
    mouseScroll: assembly.mouseScrollAbilityGroup,
    runtimeLogger: assembly.runtimeLogger,
  });

const initializeWorkbenchCore = (
  options: GrassEyeWorkbenchOptions,
): WorkbenchCore => {
  const assembly = createWorkbenchAssembly(options);
  const orchestrationRef: { instance: OrchestrationAbilityGroup | null } = {
    instance: null,
  };
  const handlerPort = createWorkbenchNerveBusHandlerPort({
    ...assembly,
    getOrchestration: () => {
      if (!orchestrationRef.instance) {
        throw new Error("Orchestration not yet initialized");
      }
      return orchestrationRef.instance;
    },
  });
  const nerveBus = createNerveBusAbilityGroup({ handlerPort });
  const orchestration = createWorkbenchOrchestration(assembly, nerveBus);
  orchestrationRef.instance = orchestration;

  return {
    assembly,
    nerveBus,
    orchestration,
    commanderConsole: createWorkbenchCommanderConsole({
      nerveBus,
      getOrchestration: () => orchestration,
    }),
  };
};

const buildSettingsHandle = (dataDir: string) => ({
  async getAppRunLimitSettings() {
    return loadAppRunLimitSettings(dataDir);
  },
  async saveAppRunLimitSettings(input: Parameters<typeof saveAppRunLimitSettings>[1]) {
    return saveAppRunLimitSettings(dataDir, input);
  },
  async getOnlineAiProviderSettings() {
    return loadOnlineAiProviderPublicStatus(dataDir);
  },
  async saveOnlineAiProviderSettings(input: Parameters<typeof saveOnlineAiProviderConfig>[1]) {
    return saveOnlineAiProviderConfig(dataDir, input);
  },
});

const buildRequirementHistoryHandle = (dataDir: string) => ({
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
});

const buildAmazonInvoiceHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  async openAdminInvoicePage(input: Parameters<typeof openAmazonInvoiceAdminPage>[1]) {
    return openAmazonInvoiceAdminPage(assembly.browserController, input);
  },
  async startAmazonInvoiceUploadMission(
    input: Parameters<typeof startAmazonInvoiceUploadMission>[1],
  ) {
    return startAmazonInvoiceUploadMission(assembly.browserController, input);
  },
  async startAmazonInvoiceUploadTask(input: Parameters<typeof startAmazonInvoiceUploadTask>[0]["task"]) {
    return startAmazonInvoiceUploadTask({
      browser: assembly.browserController,
      dataDir,
      task: input,
    });
  },
  async resumeAmazonInvoiceUploadTask(input: { taskId: string }) {
    return resumeAmazonInvoiceUploadTask({
      browser: assembly.browserController,
      dataDir,
      taskId: input.taskId,
    });
  },
  async getAmazonInvoiceUploadTaskStatus(taskId: string) {
    return getAmazonInvoiceUploadTaskStatus({ dataDir, taskId });
  },
  async getLatestAmazonInvoiceUploadTaskForInvoice(input: { amazonOrderId: string; invoiceNo?: string }) {
    return getLatestAmazonInvoiceUploadTaskForInvoice({ dataDir, ...input });
  },
});

const buildWorkbenchHandle = (
  input: BuildWorkbenchHandleInput,
): GrassEyeWorkbenchHandle => {
  const dataDir = input.assembly.dataDir;

  return {
    commanderConsole: input.commanderConsole,
    init: input.init,
    getHealthReport: async () => getHealthReport(input.assembly),
    getMissionReadinessReport: async () =>
      getMissionReadinessReport(input.assembly, input.assembly.options),
    getMissionStartPreflight: async (preflightInput: WorkbenchPreflightInput) =>
      getMissionStartPreflight(input.assembly, input.assembly.options, preflightInput),
    async getCommanderConsoleSnapshot(): Promise<WorkbenchCommanderMissionDashboardView> {
      return getCommanderConsoleSnapshot({
        commanderConsole: input.commanderConsole,
        getOrchestration: () => input.orchestration,
        capabilityGroupIds: [...ACTIVE_CAPABILITY_GROUP_IDS],
      });
    },
    getDataDir: () => dataDir,
    getModeInfo: () => getModeInfo(input.assembly.options),
    ...buildSettingsHandle(dataDir),
    ...buildRequirementHistoryHandle(dataDir),
    ...buildAmazonInvoiceHandle(input.assembly, dataDir),
  };
};

// ─── GrassEyeWorkbench ───────────────────────────────────────────────────────

export class GrassEyeWorkbench {
  private readonly _assembly: WorkbenchAssembly;
  private readonly _nerveBus: NerveBusAbilityGroup;
  private readonly _orchestration: OrchestrationAbilityGroup;
  private readonly _commanderConsole: CommanderConsoleSurface;

  constructor(options: GrassEyeWorkbenchOptions) {
    const core = initializeWorkbenchCore(options);
    this._assembly = core.assembly;
    this._nerveBus = core.nerveBus;
    this._orchestration = core.orchestration;
    this._commanderConsole = core.commanderConsole;
  }

  // ─── Init ────────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    // Data directory is created on first write by the storage layer.
    // No additional initialization is required for the minimal runtime shell.
  }

  // ─── Handle ──────────────────────────────────────────────────────────────

  createHandle(): GrassEyeWorkbenchHandle {
    return buildWorkbenchHandle({
      init: () => this.init(),
      assembly: this._assembly,
      orchestration: this._orchestration,
      commanderConsole: this._commanderConsole,
    });
  }
}
