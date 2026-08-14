import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { readJsonBody, readRequestBuffer, writeJson } from "./workbench-http.js";
import { handleDeepResearchIntervention } from "./workbench-deep-research-intervention-routes.js";

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
  "final-adjudication-raw.md",
  "full-case-file.md",
  "full-case-file.json",
  "structured-index.json",
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
  inputAttachments?: unknown;
};

type DeepResearchAttachmentInput = {
  id: string;
  filePath: string;
  mimeType: string | null;
  summary: string;
  fileHash: string | null;
  fileSizeBytes: number | null;
  sourceKind: "app-file-picker" | "manual-path";
};

type DeepResearchMultipartFile = {
  fileName: string;
  contentType: string | null;
  bytes: Buffer;
};

const isProviderKind = (value: unknown): value is DeepResearchProviderKind =>
  typeof value === "string"
  && DEEP_RESEARCH_PROVIDER_KINDS.some((providerKind) => providerKind === value);

const isExportKind = (value: unknown): value is DeepResearchExportKind =>
  typeof value === "string"
  && DEEP_RESEARCH_EXPORT_KINDS.some((kind) => kind === value);

const readTrimmedString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const readNonnegativeInteger = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;

const readLanguage = (value: unknown): "zh-CN" | "en" | null =>
  value === "zh-CN" || value === "en" ? value : null;

const readMaxSubQuestions = (value: unknown): number | null =>
  typeof value === "number"
  && Number.isInteger(value)
  && value >= 2
  && value <= 12
    ? value
    : null;

const readInputAttachments = (value: unknown): DeepResearchAttachmentInput[] | null => {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.length > 3) {
    return null;
  }
  const attachments: DeepResearchAttachmentInput[] = [];
  for (const [index, item] of value.entries()) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return null;
    }
    const record = item as Record<string, unknown>;
    const filePath = readTrimmedString(record.filePath);
    if (!filePath) {
      return null;
    }
    const id = readTrimmedString(record.id) ?? `deep-research-input-attachment-${index + 1}`;
    const summary = readTrimmedString(record.summary) ?? filePath;
    const mimeType = readTrimmedString(record.mimeType);
    const fileHash = readTrimmedString(record.fileHash);
    const fileSizeBytes = readNonnegativeInteger(record.fileSizeBytes);
    const sourceKind = record.sourceKind === "app-file-picker" ? "app-file-picker" : "manual-path";
    attachments.push({
      id,
      filePath,
      mimeType,
      summary,
      fileHash,
      fileSizeBytes,
      sourceKind,
    });
  }
  return attachments;
};

const trimMultipartBodyEnd = (body: Buffer): Buffer => {
  if (body.length >= 2 && body[body.length - 2] === 13 && body[body.length - 1] === 10) {
    return body.subarray(0, body.length - 2);
  }
  return body;
};

const splitBuffer = (buffer: Buffer, delimiter: Buffer): Buffer[] => {
  const parts: Buffer[] = [];
  let start = 0;
  let next = buffer.indexOf(delimiter, start);
  while (next >= 0) {
    parts.push(buffer.subarray(start, next));
    start = next + delimiter.length;
    next = buffer.indexOf(delimiter, start);
  }
  parts.push(buffer.subarray(start));
  return parts;
};

const readMultipartBoundary = (contentType: string | undefined): string | null => {
  if (!contentType) {
    return null;
  }
  const parts = contentType.split(";").map((part) => part.trim());
  if (parts[0]?.toLowerCase() !== "multipart/form-data") {
    return null;
  }
  const boundaryPart = parts.find((part) => part.toLowerCase().startsWith("boundary="));
  const boundary = boundaryPart?.slice("boundary=".length).replace(/^"|"$/gu, "").trim();
  return boundary && boundary.length > 0 ? boundary : null;
};

const readHeaderValue = (headers: string, headerName: string): string | null => {
  const normalizedName = headerName.toLowerCase();
  for (const line of headers.split("\r\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }
    if (line.slice(0, separatorIndex).trim().toLowerCase() === normalizedName) {
      const value = line.slice(separatorIndex + 1).trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
};

const readQuotedDispositionValue = (disposition: string | null, key: string): string | null => {
  if (!disposition) {
    return null;
  }
  const token = `${key}="`;
  const start = disposition.indexOf(token);
  if (start < 0) {
    return null;
  }
  const valueStart = start + token.length;
  const valueEnd = disposition.indexOf("\"", valueStart);
  const value = valueEnd >= 0 ? disposition.slice(valueStart, valueEnd) : "";
  return value.trim().length > 0 ? value : null;
};

const parseMultipartDeepResearchFiles = async (
  request: IncomingMessage,
): Promise<DeepResearchMultipartFile[] | null> => {
  const boundary = readMultipartBoundary(request.headers["content-type"]);
  if (!boundary) {
    return null;
  }
  const rawBody = await readRequestBuffer(request);
  if (rawBody.byteLength > 210_000_000) {
    return null;
  }
  const boundaryBuffer = Buffer.from(`--${boundary}`, "utf8");
  const files: DeepResearchMultipartFile[] = [];
  for (const rawPart of splitBuffer(rawBody, boundaryBuffer)) {
    let part = rawPart;
    if (part.length >= 2 && part[0] === 13 && part[1] === 10) {
      part = part.subarray(2);
    }
    if (part.length === 0 || (part[0] === 45 && part[1] === 45)) {
      continue;
    }
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n", "utf8"));
    if (headerEnd < 0) {
      continue;
    }
    const headers = part.subarray(0, headerEnd).toString("utf8");
    const disposition = readHeaderValue(headers, "content-disposition");
    const fileName = readQuotedDispositionValue(disposition, "filename");
    if (!fileName) {
      continue;
    }
    const bytes = trimMultipartBodyEnd(part.subarray(headerEnd + 4));
    if (bytes.byteLength === 0) {
      continue;
    }
    files.push({
      fileName,
      contentType: readHeaderValue(headers, "content-type"),
      bytes,
    });
    if (files.length > 3) {
      return null;
    }
  }
  return files;
};

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
  const inputAttachments = readInputAttachments(body.inputAttachments);
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
  if (inputAttachments === null) {
    return { error: "invalid_input_attachments" } as const;
  }
  return {
    value: {
      userQuestion,
      analysisGoal: readTrimmedString(body.analysisGoal),
      language,
      maxSubQuestions,
      outputFormat: body.outputFormat === "markdown" ? "markdown" : "markdown",
      providerKind,
      inputAttachments,
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
    finalAdjudication: snapshot.finalAdjudication,
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

const handleInputAttachmentsRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  const files = await parseMultipartDeepResearchFiles(request);
  if (!files || files.length === 0) {
    writeJson(response, 400, { error: "invalid_input_attachment_files" });
    return true;
  }
  const staged = await workbench.stageDeepResearchAnalysisInputAttachments({ files });
  writeJson(response, 200, staged);
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
  "POST:/api/deep-research-analysis/input-attachments": () => handleInputAttachmentsRequest(request, response, workbench),
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
  if (await handleDeepResearchIntervention(request, response, workbench, url)) return true;
  const routeKey = `${request.method}:${url.pathname}`;
  const handler = buildDeepResearchRouteHandlers(request, response, workbench, url)[routeKey];
  return handler ? handler() : false;
};
