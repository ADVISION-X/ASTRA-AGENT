import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { readJsonBody, writeJson } from "./workbench-http.js";

const DEEP_RESEARCH_PROVIDER_KINDS = [
  "gemini-api",
  "gemini-web-chat",
  "gpt-web-chat",
] as const;

const DEEP_RESEARCH_JOB_STATUSES = [
  "queued",
  "running",
  "completed",
  "review_required",
  "failed",
] as const;

const DEEP_RESEARCH_EXPORT_KINDS = [
  "final-report.md",
  "full-case-file.md",
  "full-case-file.json",
  "decision-package.json",
  "business-report.html",
  "evidence-index.json",
] as const;

type DeepResearchProviderKind = typeof DEEP_RESEARCH_PROVIDER_KINDS[number];
type DeepResearchExportKind = typeof DEEP_RESEARCH_EXPORT_KINDS[number];
type DeepResearchJobStatus = typeof DEEP_RESEARCH_JOB_STATUSES[number];

type DeepResearchStartRequest = {
  userQuestion?: unknown;
  analysisGoal?: unknown;
  language?: unknown;
  maxSubQuestions?: unknown;
  outputFormat?: unknown;
  providerKind?: unknown;
};

const isProviderKind = (value: unknown): value is DeepResearchProviderKind =>
  typeof value === "string"
  && DEEP_RESEARCH_PROVIDER_KINDS.some((providerKind) => providerKind === value);

const isExportKind = (value: unknown): value is DeepResearchExportKind =>
  typeof value === "string"
  && DEEP_RESEARCH_EXPORT_KINDS.some((kind) => kind === value);

const readTrimmedString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const readLanguage = (value: unknown): "zh-CN" | "en" | null =>
  value === "zh-CN" || value === "en" ? value : null;

const readMaxSubQuestions = (value: unknown): number | null =>
  typeof value === "number"
  && Number.isInteger(value)
  && value >= 2
  && value <= 12
    ? value
    : null;

const readJobId = (response: ServerResponse, url: URL): string | null => {
  const jobId = url.searchParams.get("jobId")?.trim();
  if (!jobId) {
    writeJson(response, 400, { error: "missing_job_id" });
    return null;
  }
  return jobId;
};

const readHistoryLimit = (url: URL): number | undefined => {
  const value = url.searchParams.get("limit");
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const readHistoryStatus = (value: string | null): DeepResearchJobStatus | undefined => {
  if (!value) {
    return undefined;
  }
  return DEEP_RESEARCH_JOB_STATUSES.find((status) => status === value);
};

const readStartInput = (body: DeepResearchStartRequest) => {
  const userQuestion = readTrimmedString(body.userQuestion);
  const language = readLanguage(body.language);
  const maxSubQuestions = readMaxSubQuestions(body.maxSubQuestions);
  const providerKind = isProviderKind(body.providerKind) ? body.providerKind : null;
  if (!userQuestion) {
    return { error: "missing_user_question" } as const;
  }
  if (!language) {
    return { error: "invalid_language" } as const;
  }
  if (maxSubQuestions === null) {
    return { error: "invalid_max_sub_questions" } as const;
  }
  if (!providerKind) {
    return { error: "invalid_provider_kind" } as const;
  }
  return {
    value: {
      userQuestion,
      analysisGoal: readTrimmedString(body.analysisGoal),
      language,
      maxSubQuestions,
      outputFormat: body.outputFormat === "markdown" ? "markdown" : "markdown",
      providerKind,
    },
  } as const;
};

const buildStartResponse = async (
  workbench: GrassEyeWorkbenchHandle,
  snapshot: Awaited<ReturnType<GrassEyeWorkbenchHandle["startDeepResearchAnalysis"]>>,
) => {
  const timeline = await workbench.getDeepResearchAnalysisTimeline(snapshot.job.id);
  return {
    jobId: snapshot.job.id,
    status: snapshot.job.status,
    phase: snapshot.job.phase,
    job: snapshot.job,
    overview: snapshot.overview,
    finalReport: snapshot.finalReport,
    exports: snapshot.exports,
    timeline: timeline?.timeline ?? [],
  };
};

const handleStartRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  const parsed = readStartInput(await readJsonBody(request) as DeepResearchStartRequest);
  if ("error" in parsed) {
    writeJson(response, 400, { error: parsed.error });
    return true;
  }
  const snapshot = await workbench.startDeepResearchAnalysis(parsed.value);
  writeJson(response, 200, await buildStartResponse(workbench, snapshot));
  return true;
};

const handleJobRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const jobId = readJobId(response, url);
  if (!jobId) {
    return true;
  }
  const snapshot = await workbench.getDeepResearchAnalysisJob(jobId);
  if (!snapshot) {
    writeJson(response, 404, { error: "job_not_found" });
    return true;
  }
  writeJson(response, 200, snapshot);
  return true;
};

const handleHistoryRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const limit = readHistoryLimit(url);
  const status = readHistoryStatus(url.searchParams.get("status"));
  writeJson(response, 200, await workbench.listDeepResearchAnalysisJobs({
    ...(typeof limit === "number" ? { limit } : {}),
    ...(status ? { status } : {}),
  }));
  return true;
};

const handleReportRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const jobId = readJobId(response, url);
  if (!jobId) {
    return true;
  }
  const report = await workbench.getDeepResearchAnalysisReport(jobId);
  if (!report) {
    writeJson(response, 404, { error: "job_not_found" });
    return true;
  }
  writeJson(response, 200, report);
  return true;
};

const handleLatestRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  const snapshot = await workbench.getLatestDeepResearchAnalysisJob();
  if (!snapshot) {
    writeJson(response, 404, { error: "job_not_found" });
    return true;
  }
  writeJson(response, 200, snapshot);
  return true;
};

const handleTimelineRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const jobId = readJobId(response, url);
  if (!jobId) {
    return true;
  }
  const snapshot = await workbench.getDeepResearchAnalysisTimeline(jobId);
  if (!snapshot) {
    writeJson(response, 404, { error: "job_not_found" });
    return true;
  }
  writeJson(response, 200, snapshot);
  return true;
};

const handleExportRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const jobId = readJobId(response, url);
  const kind = url.searchParams.get("kind");
  if (!jobId) {
    return true;
  }
  if (!isExportKind(kind)) {
    writeJson(response, 400, { error: "invalid_export_kind" });
    return true;
  }
  const exported = await workbench.exportDeepResearchAnalysisArtifact({ jobId, kind });
  if (!exported) {
    writeJson(response, 404, { error: "export_not_found" });
    return true;
  }
  writeJson(response, 200, exported);
  return true;
};

const handleDeleteJobRequest = async (
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const jobId = readJobId(response, url);
  if (!jobId) {
    return true;
  }
  const result = await workbench.deleteDeepResearchAnalysisJob(jobId);
  if (!result.deleted) {
    writeJson(response, 404, { error: "job_not_found" });
    return true;
  }
  writeJson(response, 200, result);
  return true;
};

type DeepResearchRouteHandler = () => Promise<boolean>;

const buildDeepResearchRouteHandlers = (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Record<string, DeepResearchRouteHandler> => ({
  "POST:/api/deep-research-analysis/start": () => handleStartRequest(request, response, workbench),
  "GET:/api/deep-research-analysis/job": () => handleJobRequest(response, workbench, url),
  "DELETE:/api/deep-research-analysis/job": () => handleDeleteJobRequest(response, workbench, url),
  "GET:/api/deep-research-analysis/history": () => handleHistoryRequest(response, workbench, url),
  "GET:/api/deep-research-analysis/report": () => handleReportRequest(response, workbench, url),
  "GET:/api/deep-research-analysis/latest": () => handleLatestRequest(response, workbench),
  "GET:/api/deep-research-analysis/timeline": () => handleTimelineRequest(response, workbench, url),
  "GET:/api/deep-research-analysis/export": () => handleExportRequest(response, workbench, url),
});

export const handleDeepResearchRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const routeKey = `${request.method}:${url.pathname}`;
  const handler = buildDeepResearchRouteHandlers(request, response, workbench, url)[routeKey];
  return handler ? handler() : false;
};
