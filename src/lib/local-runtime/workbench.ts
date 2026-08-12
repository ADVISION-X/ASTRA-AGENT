import { prepareVideoDownloadRuntimeDependencies } from "../../capabilities/video-download/index.js";
import { runXuanxueAiProductionRoute } from "../../mediator/xuanxue-ai-production-route.js";
import { createXuanxueAiProductionWorkbenchOwner } from "../../plugins/xuanxue-ai-production/index.js";
import type { GrassEyeWorkbenchOptions } from "./contract.js";
import { buildAmazonInvoiceHandle } from "./workbench-amazon-invoice-handle.js";
import { buildAmazonListingEditReadSyncHandle } from "./workbench-amazon-listing-edit-read-sync-support.js";
import { buildApiBoundaryLogHandle } from "./workbench-api-boundary-log.js";
import { createWorkbenchAssembly, type WorkbenchAssembly } from "./workbench-assembly.js";
import { buildDeepResearchAnalysisHandle } from "./workbench-deep-research-handle.js";
import type { GrassEyeWorkbenchHandle } from "./workbench-handle.js";
import { buildLotteryTicketPlanHandle } from "./workbench-lottery-ticket-plan-support.js";
import {
  buildAmazonMiningHandle,
  buildAmazonProductFeeSyncHandle,
  buildAmazonProductSyncHandle,
  buildFacebookMiningHandle,
  buildSettingsHandle,
  continueInterruptedAmazonMiningForWorkbench,
} from "./workbench-marketplace-handles.js";
import { buildPick3IsBlindEvalHandle } from "./workbench-pick3-support.js";
import {
  getHealthReport,
  getMissionReadinessReport,
  getMissionStartPreflight,
  getModeInfo,
} from "./workbench-status.js";
import { findOpenVideoDownloadSourcePage } from "./workbench-video-download-support.js";
import { buildXuanyuanHandle } from "./workbench-xuanyuan-handle.js";

const buildWorkbenchHandle = (
  assembly: WorkbenchAssembly,
  init: () => Promise<void>,
  shutdown: () => Promise<void>,
  xuanyuan: ReturnType<typeof buildXuanyuanHandle>,
): GrassEyeWorkbenchHandle => {
  const dataDir = assembly.dataDir;
  return {
    init,
    shutdown,
    ...buildApiBoundaryLogHandle(assembly),
    getHealthReport: async () => getHealthReport(assembly),
    getMissionReadinessReport: async () => getMissionReadinessReport(assembly, assembly.options),
    getMissionStartPreflight: async (input) =>
      getMissionStartPreflight(assembly, assembly.options, input),
    getDataDir: () => dataDir,
    getVideoDownloadAbilityGroup: () => assembly.videoDownload,
    getMediaProcessingAbilityGroup: () => assembly.mediaProcessing,
    findOpenVideoDownloadSourcePage,
    getAiInputGatewayAbilityGroup: () => assembly.aiInputGateway,
    getModeInfo: () => getModeInfo(assembly.options),
    ...buildSettingsHandle(dataDir),
    ...buildAmazonInvoiceHandle(assembly, dataDir),
    ...buildFacebookMiningHandle(assembly, dataDir),
    ...buildAmazonMiningHandle(assembly, dataDir),
    ...buildAmazonProductSyncHandle(assembly, dataDir),
    ...buildAmazonProductFeeSyncHandle(assembly, dataDir),
    ...buildAmazonListingEditReadSyncHandle(assembly, dataDir),
    ...buildDeepResearchAnalysisHandle(assembly, dataDir),
    ...buildPick3IsBlindEvalHandle(assembly, dataDir),
    ...buildLotteryTicketPlanHandle(),
    enqueueXuanyuanTask: xuanyuan.enqueueXuanyuanTask,
    getXuanyuanTaskStatus: xuanyuan.getXuanyuanTaskStatus,
    getLatestXuanyuanTask: xuanyuan.getLatestXuanyuanTask,
    listXuanyuanHistory: xuanyuan.listXuanyuanHistory,
  };
};

export class GrassEyeWorkbench {
  private readonly assembly: WorkbenchAssembly;
  private readonly xuanyuan: ReturnType<typeof buildXuanyuanHandle>;
  private readonly xuanxueAiProduction:
    ReturnType<typeof createXuanxueAiProductionWorkbenchOwner>;

  constructor(options: GrassEyeWorkbenchOptions) {
    this.assembly = createWorkbenchAssembly(options);
    this.xuanyuan = buildXuanyuanHandle(this.assembly);
    this.xuanxueAiProduction = createXuanxueAiProductionWorkbenchOwner(
      this.assembly.dataDir,
      this.assembly.aiInputGateway,
      this.assembly.mediaProcessing,
      runXuanxueAiProductionRoute,
    );
  }

  async init(): Promise<void> {
    await prepareVideoDownloadRuntimeDependencies();
    continueInterruptedAmazonMiningForWorkbench(this.assembly);
    await this.xuanyuan.init();
    await this.xuanxueAiProduction.init();
  }

  async shutdown(): Promise<void> {
    await this.xuanxueAiProduction.shutdown();
  }

  createHandle(): GrassEyeWorkbenchHandle {
    return buildWorkbenchHandle(
      this.assembly,
      () => this.init(),
      () => this.shutdown(),
      this.xuanyuan,
    );
  }
}
