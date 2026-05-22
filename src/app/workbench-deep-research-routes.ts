import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { readJsonBody, writeJson } from "./workbench-http.js";

const DEEP_RESEARCH_PROVIDER_KINDS = [
  "gemini-api",
  "gemini-web-chat",
  "gpt-web-chat",
] as const;

const DEEP_RESEARCH_EXPORT_KINDS = [
  "final-report.md",
  "research-bundle.json",
  "evidence-index.json",
] as const;

type DeepResearchProviderKind = typeof DEEP_RESEARCH_PROVIDER_KINDS[number];
type DeepResearchExportKind = typeof DEEP_RESEARCH_EXPORT_KINDS[number];

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

export const handleDeepResearchRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const routeKey = `${request.method}:${url.pathname}`;
  if (routeKey === "POST:/api/deep-research-analysis/start") {
    return handleStartRequest(request, response, workbench);
  }
  if (routeKey === "GET:/api/deep-research-analysis/job") {
    return handleJobRequest(response, workbench, url);
  }
  if (routeKey === "GET:/api/deep-research-analysis/latest") {
    return handleLatestRequest(response, workbench);
  }
  if (routeKey === "GET:/api/deep-research-analysis/timeline") {
    return handleTimelineRequest(response, workbench, url);
  }
  if (routeKey === "GET:/api/deep-research-analysis/export") {
    return handleExportRequest(response, workbench, url);
  }
  return false;
};
