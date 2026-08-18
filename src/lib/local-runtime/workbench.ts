import { prepareVideoDownloadRuntimeDependencies } from "../../capabilities/video-download/index.js";
import { runXuanxueAiProductionRoute } from "../../mediator/xuanxue-ai-production-route.js";
import { createXuanxueAiProductionWorkbenchOwner } from "../../plugins/xuanxue-ai-production/index.js";
import type { GrassEyeWorkbenchOptions } from "./contract.js";
import { buildAmazonInvoiceHandle } from "./workbench-amazon-invoice-handle.js";
import { buildApiBoundaryLogHandle } from "./workbench-api-boundary-log.js";
import { createWorkbenchAssembly, type WorkbenchAssembly } from "./workbench-assembly.js";
import { buildDeepResearchAnalysisHandle } from "./workbench-deep-research-handle.js";
import type { GrassEyeWorkbenchHandle } from "./workbench-handle.js";
import {
  buildAmazonMiningHandle,
  buildSettingsHandle,
  continueInterruptedAmazonMiningForWorkbench,
} from "./workbench-marketplace-handles.js";
import {
  getHealthReport,
  getMissionReadinessReport,
  getMissionStartPreflight,
  getModeInfo,
} from "./workbench-status.js";
import type { WorkbenchInitializationState } from "./workbench-status-types.js";
import { buildXuanxueAiProductionHandle } from "./workbench-xuanxue-ai-production-handle.js";

const buildWorkbenchHandle = (
  assembly: WorkbenchAssembly,
  init: () => Promise<void>,
  shutdown: () => Promise<void>,
  xuanxueAiProduction: ReturnType<typeof createXuanxueAiProductionWorkbenchOwner>,
  getInitializationState: () => WorkbenchInitializationState,
): GrassEyeWorkbenchHandle => {
  const dataDir = assembly.dataDir;
  return {
    init,
    shutdown,
    ...buildApiBoundaryLogHandle(assembly),
    getHealthReport: async () => getHealthReport(assembly, getInitializationState()),
    getMissionReadinessReport: async () => getMissionReadinessReport(assembly, assembly.options),
    getMissionStartPreflight: async (input) =>
      getMissionStartPreflight(assembly, assembly.options, input),
    getDataDir: () => dataDir,
    getMediaProcessingAbilityGroup: () => assembly.mediaProcessing,
    getModeInfo: () => getModeInfo(assembly.options),
    ...buildSettingsHandle(dataDir),
    ...buildAmazonInvoiceHandle(assembly, dataDir),
    ...buildAmazonMiningHandle(assembly, dataDir),
    ...buildDeepResearchAnalysisHandle(assembly, dataDir),
    ...buildXuanxueAiProductionHandle(xuanxueAiProduction),
  };
};

export class GrassEyeWorkbench {
  private readonly assembly: WorkbenchAssembly;
  private readonly xuanxueAiProduction:
    ReturnType<typeof createXuanxueAiProductionWorkbenchOwner>;
  private initializationState: WorkbenchInitializationState = {
    status: "initializing",
    failureReason: null,
  };

  constructor(options: GrassEyeWorkbenchOptions) {
    this.assembly = createWorkbenchAssembly(options);
    this.xuanxueAiProduction = createXuanxueAiProductionWorkbenchOwner(
      this.assembly.dataDir,
      this.assembly.aiInputGateway,
      this.assembly.mediaProcessing,
      runXuanxueAiProductionRoute,
    );
  }

  async init(): Promise<void> {
    try {
      await prepareVideoDownloadRuntimeDependencies();
      continueInterruptedAmazonMiningForWorkbench(this.assembly);
      await this.xuanxueAiProduction.init();
      this.initializationState = { status: "ready", failureReason: null };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.initializationState = {
        status: "failed",
        failureReason: reason.slice(0, 1_000),
      };
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    await this.xuanxueAiProduction.shutdown();
  }

  createHandle(): GrassEyeWorkbenchHandle {
    return buildWorkbenchHandle(
      this.assembly,
      () => this.init(),
      () => this.shutdown(),
      this.xuanxueAiProduction,
      () => this.initializationState,
    );
  }
}
