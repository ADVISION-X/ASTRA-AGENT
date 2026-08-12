import {
  deepResearchAnalysisPublicFacade,
  type DeepResearchAnalysisStartInput,
  type DeepResearchHistorySnapshot,
  type DeepResearchJobSnapshot,
  type DeepResearchTimelineSnapshot,
} from "../../plugins/deep-research-analysis/deep-research-analysis.public.js";
import { runDeepResearchAnalysisRoute } from "../../mediator/deep-research-analysis-route.js";
import type { WorkbenchAssembly } from "./workbench-assembly.js";
import { buildDeepResearchAttachmentStagingHandle } from "./workbench-deep-research-input-attachments.js";
import type {
  DeepResearchExecutionJobLike,
  DeepResearchExecutionSnapshotLike,
  DeepResearchExecutionState,
} from "./workbench-deep-research-types.js";

type DeepResearchHandleContext = {
  assembly: WorkbenchAssembly;
  dataDir: string;
  executions: Map<string, DeepResearchExecutionState>;
  applyExecutionState: <T extends DeepResearchExecutionSnapshotLike>(snapshot: T | null) => T | null;
  loadLatestSnapshot: () => DeepResearchJobSnapshot | null;
};

const applyExecutionJobState = <T extends DeepResearchExecutionJobLike>(
  executions: Map<string, DeepResearchExecutionState>,
  job: T,
  currentPhase?: DeepResearchJobSnapshot["overview"]["currentPhase"],
): T => {
  const execution = executions.get(job.id);
  if (!execution) return job;
  return {
    ...job,
    status: execution.status,
    phase: execution.status === "running" ? currentPhase ?? execution.phase : execution.phase,
    failureReason: execution.failureReason ?? job.failureReason ?? null,
    reviewReason: execution.reviewReason ?? job.reviewReason ?? null,
  };
};

const applyExecutionState = <T extends DeepResearchExecutionSnapshotLike>(
  executions: Map<string, DeepResearchExecutionState>,
  snapshot: T | null,
): T | null => snapshot ? {
  ...snapshot,
  job: applyExecutionJobState(executions, snapshot.job, snapshot.overview?.currentPhase),
} : null;

const trackExecution = (input: {
  executions: Map<string, DeepResearchExecutionState>;
  snapshot: DeepResearchJobSnapshot;
  runPromise: ReturnType<typeof deepResearchAnalysisPublicFacade.runDeepResearchAnalysis>;
}): void => {
  input.executions.set(input.snapshot.job.id, {
    status: "running",
    phase: input.snapshot.overview.currentPhase,
    failureReason: null,
    reviewReason: null,
  });
  void input.runPromise.then((result) => {
    const execution = input.executions.get(result.jobId);
    if (!execution) return;
    execution.status = result.jobStatus;
    execution.phase = result.phase;
    execution.failureReason = result.failureReason;
    execution.reviewReason = result.reviewReason;
  }).catch((error) => {
    const execution = input.executions.get(input.snapshot.job.id);
    if (!execution) return;
    execution.status = "failed";
    execution.phase = input.snapshot.overview.currentPhase;
    execution.failureReason = error instanceof Error ? error.message : String(error);
    execution.reviewReason = null;
  });
};

const buildStartHandle = (context: DeepResearchHandleContext) => ({
  async startDeepResearchAnalysis(input: DeepResearchAnalysisStartInput) {
    const previousLatest = context.loadLatestSnapshot();
    const runPromise = runDeepResearchAnalysisRoute(input, {
      aiInputGateway: context.assembly.aiInputGateway,
      runtimeLogger: context.assembly.runtimeLogger,
      dataDir: context.dataDir,
      modelName: "workbench-default",
      timeoutMs: 180_000,
    });
    const snapshot = context.loadLatestSnapshot() ?? previousLatest;
    if (!snapshot) throw new Error("Deep Research job was not created.");
    trackExecution({ executions: context.executions, snapshot, runPromise });
    return context.applyExecutionState(snapshot) ?? snapshot;
  },
});

const buildQueryHandle = (context: DeepResearchHandleContext) => ({
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
    return { jobs: history.jobs.map((job) => applyExecutionJobState(context.executions, job)) };
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
    return deepResearchAnalysisPublicFacade.deleteDeepResearchAnalysisJob({ dataDir: context.dataDir, jobId });
  },
});

export const buildDeepResearchAnalysisHandle = (assembly: WorkbenchAssembly, dataDir: string) => {
  const executions = new Map<string, DeepResearchExecutionState>();
  const context: DeepResearchHandleContext = {
    assembly,
    dataDir,
    executions,
    applyExecutionState: <T extends DeepResearchExecutionSnapshotLike>(snapshot: T | null) =>
      applyExecutionState(executions, snapshot),
    loadLatestSnapshot: () => deepResearchAnalysisPublicFacade.getLatestDeepResearchAnalysisJob({ dataDir }),
  };
  return {
    ...buildStartHandle(context),
    ...buildDeepResearchAttachmentStagingHandle(dataDir),
    ...buildQueryHandle(context),
  };
};
