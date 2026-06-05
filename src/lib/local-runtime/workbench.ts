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
import { buildApiBoundaryLogHandle } from "./workbench-api-boundary-log.js";
import {
  createWorkbenchAssembly,
  type WorkbenchAssembly,
} from "./workbench-assembly.js";
import { buildAmazonInvoiceHandle } from "./workbench-amazon-invoice-handle.js";
import type { GrassEyeWorkbenchOptions } from "./contract.js";
import type { GrassEyeWorkbenchHandle } from "./workbench-handle.js";
import {
  exportFacebookProductVideoMiningSelectionRecords,
  getFacebookProductVideoMiningRunStatus,
  getLatestFacebookProductVideoMiningRun,
  listFacebookProductVideoMiningSavedRecords,
  startFacebookProductVideoMiningMission,
} from "../../plugins/facebook-product-video-mining/index.js";
import {
  startAmazonProductMiningMission,
  getAmazonProductMiningTaskStatus,
  getLatestAmazonProductMiningTask,
  listAmazonProductMiningKeywordReviews,
  getAmazonProductMiningKeywordReview,
  exportAmazonProductMiningResult,
  continueInterruptedAmazonProductMiningTasks,
} from "../../plugins/amazon-product-mining/index.js";
import {
  getAmazonProductSyncTaskStatus,
  getLatestAmazonProductSyncTask,
  startAmazonProductSyncTask,
} from "../../plugins/amazon-product-sync/index.js";
import {
  getAmazonProductFeeSyncTaskStatus,
  getLatestAmazonProductFeeSyncTask,
  startAmazonProductFeeSyncTask,
} from "../../plugins/amazon-product-fee-sync/index.js";
import {
  deepResearchAnalysisPublicFacade,
  type DeepResearchAnalysisStartInput,
  type DeepResearchHistorySnapshot,
  type DeepResearchJobSnapshot,
  type DeepResearchReportViewModel,
  type DeepResearchTimelineSnapshot,
} from "../../plugins/deep-research-analysis/deep-research-analysis.public.js";
import { prepareMediaProcessingRuntimeDependencies } from "../../capabilities/media-processing/index.js";
import { prepareVideoDownloadRuntimeDependencies } from "../../capabilities/video-download/index.js";

type DeepResearchExecutionState = {
  status: DeepResearchJobSnapshot["job"]["status"];
  phase: DeepResearchJobSnapshot["job"]["phase"];
  failureReason: string | null;
  reviewReason: string | null;
};

type DeepResearchExecutionJobLike = {
  id: string;
  status: DeepResearchJobSnapshot["job"]["status"];
  phase: DeepResearchJobSnapshot["job"]["phase"];
  failureReason?: string | null;
  reviewReason?: string | null;
};

type DeepResearchExecutionSnapshotLike = {
  job: DeepResearchExecutionJobLike;
  overview?: { currentPhase: DeepResearchJobSnapshot["overview"]["currentPhase"] };
};

type DeepResearchHandleContext = {
  assembly: WorkbenchAssembly;
  dataDir: string;
  executions: Map<string, DeepResearchExecutionState>;
  applyExecutionState: <T extends DeepResearchExecutionSnapshotLike>(snapshot: T | null) => T | null;
  loadLatestSnapshot: () => DeepResearchJobSnapshot | null;
};

const applyDeepResearchExecutionJobState = <T extends DeepResearchExecutionJobLike>(
  executions: Map<string, DeepResearchExecutionState>,
  job: T,
  currentPhase?: DeepResearchJobSnapshot["overview"]["currentPhase"],
): T => {
  const execution = executions.get(job.id);
  if (!execution) return job;
  return {
    ...job,
    status: execution.status,
    phase: execution.status === "running"
      ? currentPhase ?? execution.phase
      : execution.phase,
    failureReason: execution.failureReason ?? job.failureReason ?? null,
    reviewReason: execution.reviewReason ?? job.reviewReason ?? null,
  };
};

const applyDeepResearchExecutionState = <
  T extends DeepResearchExecutionSnapshotLike,
>(
  executions: Map<string, DeepResearchExecutionState>,
  snapshot: T | null,
): T | null => {
  if (!snapshot) return null;
  return {
    ...snapshot,
    job: applyDeepResearchExecutionJobState(
      executions,
      snapshot.job,
      snapshot.overview?.currentPhase,
    ),
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

const buildAmazonMiningRuntime = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  dataDir,
  browser: assembly.browserController,
  aiInputGateway: assembly.aiInputGateway,
  runtimeLogger: assembly.runtimeLogger,
});

const buildAmazonMiningTaskHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  startAmazonProductMiningMission(rawInput: unknown) {
    return startAmazonProductMiningMission({
      rawInput,
      ...buildAmazonMiningRuntime(assembly, dataDir),
    });
  },
  getAmazonProductMiningTaskStatus(taskId: string) {
    return getAmazonProductMiningTaskStatus({ dataDir, taskId });
  },
  getLatestAmazonProductMiningTask() {
    return getLatestAmazonProductMiningTask({ dataDir });
  },
  exportAmazonProductMiningResult(taskId: string) {
    return exportAmazonProductMiningResult({ dataDir, taskId });
  },
});

const buildAmazonMiningReviewHandle = (dataDir: string) => ({
  listAmazonProductMiningKeywordReviews(taskId?: string) {
    return listAmazonProductMiningKeywordReviews(
      taskId ? { dataDir, taskId } : { dataDir },
    );
  },
  getAmazonProductMiningKeywordReview(reviewId: string) {
    return getAmazonProductMiningKeywordReview({ dataDir, reviewId });
  },
});

const buildAmazonMiningControlHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  continueInterruptedAmazonProductMiningTasks() {
    return continueInterruptedAmazonProductMiningTasks(
      buildAmazonMiningRuntime(assembly, dataDir),
    );
  },
});

const buildAmazonMiningHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  ...buildAmazonMiningTaskHandle(assembly, dataDir),
  ...buildAmazonMiningReviewHandle(dataDir),
  ...buildAmazonMiningControlHandle(assembly, dataDir),
});

const buildAmazonProductSyncHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  async startAmazonProductSyncTask(rawInput: unknown) {
    return startAmazonProductSyncTask(rawInput, {
      dataDir,
      browser: assembly.browserController,
      runtimeLogger: assembly.runtimeLogger,
    });
  },
  async getAmazonProductSyncTaskStatus(taskId: string) {
    return getAmazonProductSyncTaskStatus({
      dataDir,
      taskId,
      runtimeLogger: assembly.runtimeLogger,
    });
  },
  async getLatestAmazonProductSyncTask() {
    return getLatestAmazonProductSyncTask({
      dataDir,
      runtimeLogger: assembly.runtimeLogger,
    });
  },
});

const buildAmazonProductFeeSyncHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => ({
  async startAmazonProductFeeSyncTask(rawInput: unknown) {
    return startAmazonProductFeeSyncTask(rawInput, {
      dataDir,
      browser: assembly.browserController,
      runtimeLogger: assembly.runtimeLogger,
    });
  },
  async getAmazonProductFeeSyncTaskStatus(taskId: string) {
    return getAmazonProductFeeSyncTaskStatus({
      dataDir,
      taskId,
      runtimeLogger: assembly.runtimeLogger,
    });
  },
  async getLatestAmazonProductFeeSyncTask() {
    return getLatestAmazonProductFeeSyncTask({
      dataDir,
      runtimeLogger: assembly.runtimeLogger,
    });
  },
});

const buildDeepResearchStartHandle = (context: DeepResearchHandleContext) => ({
  async startDeepResearchAnalysis(input: DeepResearchAnalysisStartInput) {
    const previousLatest = context.loadLatestSnapshot();
    const runPromise = deepResearchAnalysisPublicFacade.runDeepResearchAnalysis(
      {
        userQuestion: input.userQuestion,
        analysisGoal: input.analysisGoal ?? null,
        language: input.language,
        maxSubQuestions: input.maxSubQuestions,
        outputFormat: input.outputFormat,
      },
      {
        aiInputGateway: context.assembly.aiInputGateway,
        runtimeLogger: context.assembly.runtimeLogger,
        dataDir: context.dataDir,
        providerKind: input.providerKind,
        modelName: "workbench-default",
        timeoutMs: 180_000,
      },
    );

    const latestSnapshot = context.loadLatestSnapshot();
    const snapshot = latestSnapshot ?? previousLatest;
    if (!snapshot) {
      throw new Error("Deep Research job was not created.");
    }
    trackDeepResearchExecution({ executions: context.executions, snapshot, runPromise });
    return context.applyExecutionState(snapshot) ?? snapshot;
  },
});

const buildDeepResearchQueryHandle = (context: DeepResearchHandleContext) => ({
  async getDeepResearchAnalysisJob(jobId: string) {
    return context.applyExecutionState(
      deepResearchAnalysisPublicFacade.getDeepResearchAnalysisJob({ dataDir: context.dataDir, jobId }),
    );
  },
  async listDeepResearchAnalysisJobs(input?: {
    limit?: number;
    status?: DeepResearchHistorySnapshot["jobs"][number]["status"];
  }) {
    const history = deepResearchAnalysisPublicFacade.listDeepResearchAnalysisHistory({
      dataDir: context.dataDir,
      ...(typeof input?.limit === "number" ? { limit: input.limit } : {}),
      ...(input?.status ? { status: input.status } : {}),
    });
    return {
      jobs: history.jobs.map((job) => applyDeepResearchExecutionJobState(context.executions, job)),
    };
  },
  async getDeepResearchAnalysisReport(jobId: string) {
    return context.applyExecutionState(
      deepResearchAnalysisPublicFacade.getDeepResearchAnalysisReport({ dataDir: context.dataDir, jobId }),
    );
  },
  async getLatestDeepResearchAnalysisJob() {
    return context.applyExecutionState(context.loadLatestSnapshot());
  },
  async getDeepResearchAnalysisTimeline(jobId: string) {
    return context.applyExecutionState(
      deepResearchAnalysisPublicFacade.getDeepResearchAnalysisTimeline({ dataDir: context.dataDir, jobId }) as DeepResearchTimelineSnapshot | null,
    );
  },
  async exportDeepResearchAnalysisArtifact(input: {
    jobId: string;
    kind: Parameters<typeof deepResearchAnalysisPublicFacade.getDeepResearchExportArtifact>[0]["kind"];
  }) {
    return deepResearchAnalysisPublicFacade.getDeepResearchExportArtifact({
      dataDir: context.dataDir,
      jobId: input.jobId,
      kind: input.kind,
    });
  },
  async deleteDeepResearchAnalysisJob(jobId: string) {
    context.executions.delete(jobId);
    return deepResearchAnalysisPublicFacade.deleteDeepResearchAnalysisJob({
      dataDir: context.dataDir,
      jobId,
    });
  },
});

const buildDeepResearchAnalysisHandle = (
  assembly: WorkbenchAssembly,
  dataDir: string,
) => {
  const executions = new Map<string, DeepResearchExecutionState>();
  const applyExecutionState = <T extends DeepResearchExecutionSnapshotLike>(snapshot: T | null) =>
    applyDeepResearchExecutionState(executions, snapshot);
  const loadLatestSnapshot = () =>
    deepResearchAnalysisPublicFacade.getLatestDeepResearchAnalysisJob({ dataDir });
  const context: DeepResearchHandleContext = {
    assembly,
    dataDir,
    executions,
    applyExecutionState,
    loadLatestSnapshot,
  };

  return {
    ...buildDeepResearchStartHandle(context),
    ...buildDeepResearchQueryHandle(context),
  };
};

const buildWorkbenchHandle = (
  assembly: WorkbenchAssembly,
  init: () => Promise<void>,
): GrassEyeWorkbenchHandle => {
  const dataDir = assembly.dataDir;
  return {
    init,
    ...buildApiBoundaryLogHandle(assembly),
    getHealthReport: async () => getHealthReport(assembly),
    getMissionReadinessReport: async () =>
      getMissionReadinessReport(assembly, assembly.options),
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
    ...buildDeepResearchAnalysisHandle(assembly, dataDir),
  };
};

export class GrassEyeWorkbench {
  private readonly assembly: WorkbenchAssembly;

  constructor(options: GrassEyeWorkbenchOptions) {
    this.assembly = createWorkbenchAssembly(options);
  }

  async init(): Promise<void> {
    await prepareVideoDownloadRuntimeDependencies();
    await prepareMediaProcessingRuntimeDependencies();
    continueInterruptedAmazonProductMiningTasks({
      dataDir: this.assembly.dataDir,
      browser: this.assembly.browserController,
      aiInputGateway: this.assembly.aiInputGateway,
      runtimeLogger: this.assembly.runtimeLogger,
    });
  }

  createHandle(): GrassEyeWorkbenchHandle {
    return buildWorkbenchHandle(this.assembly, () => this.init());
  }
}
