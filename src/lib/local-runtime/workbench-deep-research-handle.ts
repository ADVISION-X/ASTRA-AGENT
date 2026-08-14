import {
  deepResearchAnalysisPublicFacade,
  type DeepResearchAnalysisStartInput,
  type DeepResearchHistorySnapshot,
} from "../../plugins/deep-research-analysis/deep-research-analysis.public.js";
import {
  runCancelDeepResearchRoute,
  runDeepResearchAnalysisRoute,
  runPauseDeepResearchRoute,
  runResumeDeepResearchRoute,
  runTakeoverDeepResearchRoute,
} from "../../mediator/deep-research-analysis-route.js";
import type { WorkbenchAssembly } from "./workbench-assembly.js";
import { buildDeepResearchAttachmentStagingHandle } from "./workbench-deep-research-input-attachments.js";

export const buildDeepResearchAnalysisHandle = (assembly: WorkbenchAssembly, dataDir: string) => ({
  async startDeepResearchAnalysis(input: DeepResearchAnalysisStartInput) {
    const runPromise = runDeepResearchAnalysisRoute(input, {
      aiInputGateway: assembly.aiInputGateway,
      runtimeLogger: assembly.runtimeLogger,
      dataDir,
      modelName: "workbench-default",
      timeoutMs: 180_000,
    });
    const snapshot = deepResearchAnalysisPublicFacade.getLatestDeepResearchAnalysisJob({ dataDir });
    if (!snapshot) throw new Error("Deep Research job was not created.");
    void runPromise.catch(() => undefined);
    return snapshot;
  },
  ...buildDeepResearchAttachmentStagingHandle(dataDir),
  ...buildDeepResearchReadHandle(dataDir),
  ...buildDeepResearchInterventionHandle(assembly, dataDir),
});

const buildDeepResearchReadHandle = (dataDir: string) => ({
  async getDeepResearchAnalysisJob(jobId: string) {
    return deepResearchAnalysisPublicFacade.getDeepResearchAnalysisJob({ dataDir, jobId });
  },
  async listDeepResearchAnalysisJobs(input?: {
    limit?: number;
    status?: DeepResearchHistorySnapshot["jobs"][number]["status"];
  }) {
    return deepResearchAnalysisPublicFacade.listDeepResearchAnalysisHistory({
      dataDir,
      ...(typeof input?.limit === "number" ? { limit: input.limit } : {}),
      ...(input?.status ? { status: input.status } : {}),
    });
  },
  async getDeepResearchAnalysisReport(jobId: string) {
    return deepResearchAnalysisPublicFacade.getDeepResearchAnalysisReport({ dataDir, jobId });
  },
  async getLatestDeepResearchAnalysisJob() {
    return deepResearchAnalysisPublicFacade.getLatestDeepResearchAnalysisJob({ dataDir });
  },
  async getDeepResearchAnalysisTimeline(jobId: string) {
    return deepResearchAnalysisPublicFacade.getDeepResearchAnalysisTimeline({ dataDir, jobId });
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
  async deleteDeepResearchAnalysisJob(jobId: string) {
    return deepResearchAnalysisPublicFacade.deleteDeepResearchAnalysisJob({ dataDir, jobId });
  },
});

const buildDeepResearchInterventionHandle = (assembly: WorkbenchAssembly, dataDir: string) => ({
  async readDeepResearchIntervention(jobId: string) {
    return deepResearchAnalysisPublicFacade.readDeepResearchIntervention(dataDir, jobId);
  },
  async pauseDeepResearch(input: Parameters<typeof runPauseDeepResearchRoute>[0]) {
    return runPauseDeepResearchRoute(input, dataDir);
  },
  async cancelDeepResearch(input: Parameters<typeof runCancelDeepResearchRoute>[0]) {
    return runCancelDeepResearchRoute(input, dataDir);
  },
  async takeoverDeepResearch(input: Parameters<typeof runTakeoverDeepResearchRoute>[0]) {
    return runTakeoverDeepResearchRoute(input, dataDir);
  },
  async resumeDeepResearch(input: Parameters<typeof runResumeDeepResearchRoute>[0]) {
    const snapshot = runResumeDeepResearchRoute(input, dataDir);
    assembly.aiInputGateway.resumeProviderTargetAfterOperator?.(`deep-research-analysis:${input.taskId}`);
    return snapshot;
  },
});
