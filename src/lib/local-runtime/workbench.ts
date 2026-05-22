import {
  findOpenVideoDownloadSourcePage,
} from "./workbench-video-download-support.js";
import {
  loadAppRunLimitSettings,
  saveAppRunLimitSettings,
} from "./settings.js";
import {
  getHealthReport,
  getMissionReadinessReport,
  getMissionStartPreflight,
  getModeInfo,
} from "./workbench-status.js";
import {
  loadOnlineAiProviderPublicStatus,
  saveOnlineAiProviderConfig,
} from "../online-ai/index.js";
import {
  createWorkbenchAssembly,
  type WorkbenchAssembly,
} from "./workbench-assembly.js";
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
import {
  exportFacebookProductVideoMiningSelectionRecords,
  getFacebookProductVideoMiningRunStatus,
  getLatestFacebookProductVideoMiningRun,
  listFacebookProductVideoMiningSavedRecords,
  startFacebookProductVideoMiningMission,
} from "../../plugins/facebook-product-video-mining/index.js";
import {
  deepResearchAnalysisPublicFacade,
  type DeepResearchAnalysisStartInput,
  type DeepResearchJobSnapshot,
  type DeepResearchTimelineSnapshot,
} from "../../plugins/deep-research-analysis/index.js";

type DeepResearchExecutionState = {
  status: DeepResearchJobSnapshot["job"]["status"];
  phase: DeepResearchJobSnapshot["job"]["phase"];
  failureReason: string | null;
  reviewReason: string | null;
};

const applyDeepResearchExecutionState = <
  T extends {
    job: DeepResearchJobSnapshot["job"];
    overview?: { currentPhase: DeepResearchJobSnapshot["overview"]["currentPhase"] };
  },
>(
  executions: Map<string, DeepResearchExecutionState>,
  snapshot: T | null,
): T | null => {
  if (!snapshot) return null;
  const execution = executions.get(snapshot.job.id);
  if (!execution) return snapshot;
  return {
    ...snapshot,
    job: {
      ...snapshot.job,
      status: execution.status,
      phase: execution.status === "running"
        ? snapshot.overview?.currentPhase ?? execution.phase
        : execution.phase,
      failureReason: execution.failureReason ?? snapshot.job.failureReason,
      reviewReason: execution.reviewReason ?? snapshot.job.reviewReason,
    },
  };
};

const trackDeepResearchExecution = (
  input: {
    executions: Map<string, DeepResearchExecutionState>;
    snapshot: DeepResearchJobSnapshot;
    runPromise: ReturnType<typeof deepResearchAnalysisPublicFacade.runDeepResearchAnalysis>;
  },
): void => {
  input.executions.set(input.snapshot.job.id, {
    status: "running",
    phase: input.snapshot.overview.currentPhase,
    failureReason: null,
    reviewReason: null,
  });
  void input.runPromise
    .then((result) => {
      const execution = input.executions.get(result.jobId);
      if (!execution) return;
      execution.status = result.jobStatus;
      execution.phase = result.phase;
      execution.failureReason = result.failureReason;
      execution.reviewReason = result.reviewReason;
    })
    .catch((error) => {
      const execution = input.executions.get(input.snapshot.job.id);
      if (!execution) return;
      execution.status = "failed";
      execution.phase = input.snapshot.overview.currentPhase;
      execution.failureReason = error instanceof Error ? error.message : String(error);
      execution.reviewReason = null;
    });
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

const buildAmazonInvoiceHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  ...buildAmazonInvoiceMissionHandle(assembly),
  ...buildAmazonInvoiceTaskHandle(assembly, dataDir),
});

const buildAmazonInvoiceMissionHandle = (assembly: WorkbenchAssembly) => ({
  async openAdminInvoicePage(input: Parameters<typeof openAmazonInvoiceAdminPage>[1]) {
    return openAmazonInvoiceAdminPage(assembly.browserController, input);
  },
  async startAmazonInvoiceUploadMission(
    input: Parameters<typeof startAmazonInvoiceUploadMission>[2],
  ) {
    return startAmazonInvoiceUploadMission(assembly.browserController, assembly.runtimeLogger, input);
  },
});

const buildAmazonInvoiceTaskHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  async startAmazonInvoiceUploadTask(input: Parameters<typeof startAmazonInvoiceUploadTask>[0]["task"]) {
    return startAmazonInvoiceUploadTask({
      browser: assembly.browserController,
      runtimeLogger: assembly.runtimeLogger,
      dataDir,
      task: input,
    });
  },
  async resumeAmazonInvoiceUploadTask(input: { taskId: string }) {
    return resumeAmazonInvoiceUploadTask({
      browser: assembly.browserController,
      runtimeLogger: assembly.runtimeLogger,
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

const buildFacebookMiningHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  async startFacebookProductVideoMiningMission(
    input: Parameters<typeof startFacebookProductVideoMiningMission>[0],
  ) {
    return startFacebookProductVideoMiningMission(input, {
      browser: assembly.browserController,
      videoDownload: assembly.videoDownload,
      aiInputGateway: assembly.aiInputGateway,
      runtimeLogger: assembly.runtimeLogger,
      dataDir,
    });
  },
  async getFacebookProductVideoMiningRunStatus(runId: string) {
    return getFacebookProductVideoMiningRunStatus({ dataDir, runId });
  },
  async getLatestFacebookProductVideoMiningRun() {
    return getLatestFacebookProductVideoMiningRun({ dataDir });
  },
  async listFacebookProductVideoMiningSavedRecords(runId: string) {
    return listFacebookProductVideoMiningSavedRecords({ dataDir, runId });
  },
  async exportFacebookProductVideoMiningSelectionRecords(runId: string) {
    return exportFacebookProductVideoMiningSelectionRecords({ dataDir, runId });
  },
});

const buildDeepResearchAnalysisHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => {
  const executions = new Map<string, DeepResearchExecutionState>();
  const applyExecutionState = <T extends { job: DeepResearchJobSnapshot["job"]; overview?: { currentPhase: DeepResearchJobSnapshot["overview"]["currentPhase"] } }>(snapshot: T | null) =>
    applyDeepResearchExecutionState(executions, snapshot);
  const loadLatestSnapshot = () =>
    deepResearchAnalysisPublicFacade.getLatestDeepResearchAnalysisJob({ dataDir });

  return {
    async startDeepResearchAnalysis(input: DeepResearchAnalysisStartInput) {
      const previousLatest = loadLatestSnapshot();
      const runPromise = deepResearchAnalysisPublicFacade.runDeepResearchAnalysis(
        {
          userQuestion: input.userQuestion,
          analysisGoal: input.analysisGoal ?? null,
          language: input.language,
          maxSubQuestions: input.maxSubQuestions,
          outputFormat: input.outputFormat,
        },
        {
          aiInputGateway: assembly.aiInputGateway,
          runtimeLogger: assembly.runtimeLogger,
          dataDir,
          providerKind: input.providerKind,
          modelName: "workbench-default",
          timeoutMs: 180_000,
        },
      );

      const latestSnapshot = loadLatestSnapshot();
      const snapshot = latestSnapshot ?? previousLatest;
      if (!snapshot) {
        throw new Error("Deep Research job was not created.");
      }
      trackDeepResearchExecution({ executions, snapshot, runPromise });

      return applyExecutionState(snapshot) ?? snapshot;
    },
    async getDeepResearchAnalysisJob(jobId: string) {
      return applyExecutionState(
        deepResearchAnalysisPublicFacade.getDeepResearchAnalysisJob({ dataDir, jobId }),
      );
    },
    async getLatestDeepResearchAnalysisJob() {
      return applyExecutionState(loadLatestSnapshot());
    },
    async getDeepResearchAnalysisTimeline(jobId: string) {
      return applyExecutionState(
        deepResearchAnalysisPublicFacade.getDeepResearchAnalysisTimeline({ dataDir, jobId }) as DeepResearchTimelineSnapshot | null,
      );
    },
    async exportDeepResearchAnalysisArtifact(input: {
      jobId: string;
      kind: Parameters<typeof deepResearchAnalysisPublicFacade.getDeepResearchExportArtifact>[0]["kind"];
    }) {
      return deepResearchAnalysisPublicFacade.getDeepResearchExportArtifact({
        dataDir,
        jobId: input.jobId,
        kind: input.kind,
      });
    },
  };
};

const buildWorkbenchHandle = (
  assembly: WorkbenchAssembly,
  init: () => Promise<void>,
): GrassEyeWorkbenchHandle => {
  const dataDir = assembly.dataDir;
  return {
    init,
    getHealthReport: async () => getHealthReport(assembly),
    getMissionReadinessReport: async () =>
      getMissionReadinessReport(assembly, assembly.options),
    getMissionStartPreflight: async (input) =>
      getMissionStartPreflight(assembly, assembly.options, input),
    getDataDir: () => dataDir,
    getVideoDownloadAbilityGroup: () => assembly.videoDownload,
    findOpenVideoDownloadSourcePage,
    getAiInputGatewayAbilityGroup: () => assembly.aiInputGateway,
    getModeInfo: () => getModeInfo(assembly.options),
    ...buildSettingsHandle(dataDir),
    ...buildAmazonInvoiceHandle(assembly, dataDir),
    ...buildFacebookMiningHandle(assembly, dataDir),
    ...buildDeepResearchAnalysisHandle(assembly, dataDir),
  };
};

export class GrassEyeWorkbench {
  private readonly assembly: WorkbenchAssembly;

  constructor(options: GrassEyeWorkbenchOptions) {
    this.assembly = createWorkbenchAssembly(options);
  }

  async init(): Promise<void> {
    // Storage is created lazily by the first evidence or task write.
  }

  createHandle(): GrassEyeWorkbenchHandle {
    return buildWorkbenchHandle(this.assembly, () => this.init());
  }
}
