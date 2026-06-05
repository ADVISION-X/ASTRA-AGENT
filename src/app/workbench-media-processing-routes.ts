import { copyFile, mkdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir } from "node:os";
import path from "node:path";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { routeMediaProcessingArtifactJob } from "../mediator/media-processing-artifact-route.js";
import { readJsonBody, writeJson } from "./workbench-http.js";

const MEDIA_PROCESSING_CHILDREN = [
  "optimize-image-for-web-once",
  "resize-image-for-web-once",
  "generate-responsive-image-variants-once",
  "optimize-video-for-web-once",
  "compress-video-for-web-once",
  "generate-video-poster-once",
] as const;

const MEDIA_PROCESSING_OUTPUT_FORMATS = ["webp", "jpeg", "png", "mp4"] as const;
const MEDIA_PROCESSING_PRESETS = [
  "web-image",
  "web-image-responsive",
  "web-video",
  "web-video-compressed",
  "web-video-poster",
] as const;

type MediaProcessingChildId = typeof MEDIA_PROCESSING_CHILDREN[number];
type MediaProcessingOutputFormat = typeof MEDIA_PROCESSING_OUTPUT_FORMATS[number];
type MediaProcessingPresetId = typeof MEDIA_PROCESSING_PRESETS[number];

type MediaProcessingRequestBody = {
  inputFilePath?: unknown;
  fileName?: unknown;
  fileContentBase64?: unknown;
  childCapabilityId?: unknown;
  presetId?: unknown;
  outputFormat?: unknown;
  quality?: unknown;
  maxWidth?: unknown;
  maxHeight?: unknown;
  targetWidth?: unknown;
  targetHeight?: unknown;
  variantWidths?: unknown;
  posterTimestampSeconds?: unknown;
  timeoutMs?: unknown;
  saveToDownloads?: unknown;
};

type MediaProcessingTaskSnapshot = {
  taskId: string;
  status: "running" | "success" | "failed" | "review_required" | "invalid_input";
  startedAt: string;
  updatedAt: string;
  childCapabilityId: MediaProcessingChildId;
  sourceFileName: string;
  record: Awaited<ReturnType<typeof routeMediaProcessingArtifactJob>> | null;
  downloadsPath: string | null;
  downloadsPaths: string[];
  failureReason: string | null;
};

const mediaProcessingTasks = new Map<string, MediaProcessingTaskSnapshot>();
const MEDIA_PROCESSING_TASK_TTL_MS = 24 * 60 * 60 * 1000;
const MEDIA_PROCESSING_MAX_RUNNING_TASKS = 2;
const MEDIA_PROCESSING_UPLOAD_MAX_BYTES = 250_000_000;
const MEDIA_PROCESSING_TASK_PERSISTENCE_FAILED = "media_processing_task_persistence_failed";

const isMediaProcessingChildId = (value: unknown): value is MediaProcessingChildId =>
  typeof value === "string" && MEDIA_PROCESSING_CHILDREN.some((child) => child === value);

const isMediaProcessingOutputFormat = (value: unknown): value is MediaProcessingOutputFormat =>
  typeof value === "string" && MEDIA_PROCESSING_OUTPUT_FORMATS.some((format) => format === value);

const isMediaProcessingPresetId = (value: unknown): value is MediaProcessingPresetId =>
  typeof value === "string" && MEDIA_PROCESSING_PRESETS.some((preset) => preset === value);

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const readPositiveInteger = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;

const readNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const safeFileName = (value: string): string => {
  const cleaned = [...value.trim()]
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code < 32 || char === "/" || char === "\\" || char === ":" || char === "*" || char === "?" || char === "\"" || char === "<" || char === ">" || char === "|") {
        return "-";
      }
      return char;
    })
    .join("")
    .slice(0, 160)
    .trim();
  return cleaned || "media-input";
};

const taskStoreDir = (workbench: GrassEyeWorkbenchHandle): string =>
  path.join(workbench.getDataDir(), "runtime-data", "media-processing-tasks");

const taskStorePath = (workbench: GrassEyeWorkbenchHandle, taskId: string): string =>
  path.join(taskStoreDir(workbench), `${taskId}.json`);

const persistMediaProcessingTask = async (
  workbench: GrassEyeWorkbenchHandle,
  task: MediaProcessingTaskSnapshot,
): Promise<void> => {
  await mkdir(taskStoreDir(workbench), { recursive: true });
  const destination = taskStorePath(workbench, task.taskId);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(task, null, 2)}\n`);
  await rename(temporary, destination);
};

const readPersistedMediaProcessingTask = async (
  workbench: GrassEyeWorkbenchHandle,
  taskId: string,
): Promise<MediaProcessingTaskSnapshot | null> => {
  try {
    const parsed = JSON.parse(await readFile(taskStorePath(workbench, taskId), "utf8")) as MediaProcessingTaskSnapshot;
    if (parsed.taskId !== taskId) return null;
    const task = {
      ...parsed,
      downloadsPaths: Array.isArray(parsed.downloadsPaths) ? parsed.downloadsPaths : [],
    };
    return parsed.status === "running"
      ? {
          ...task,
          status: "failed",
          updatedAt: new Date().toISOString(),
          failureReason: "media_processing_task_interrupted_before_completion",
        }
      : task;
  } catch {
    return null;
  }
};

const pruneMediaProcessingTasks = (): void => {
  const now = Date.now();
  for (const [taskId, task] of mediaProcessingTasks) {
    if (now - Date.parse(task.updatedAt) > MEDIA_PROCESSING_TASK_TTL_MS) {
      mediaProcessingTasks.delete(taskId);
    }
  }
};

const runningTaskCount = (): number => {
  pruneMediaProcessingTasks();
  return [...mediaProcessingTasks.values()].filter((task) => task.status === "running").length;
};

const persistenceFailureReason = (error: unknown): string =>
  `${MEDIA_PROCESSING_TASK_PERSISTENCE_FAILED}: ${error instanceof Error ? error.message : String(error)}`;

const persistTerminalMediaProcessingTask = async (
  workbench: GrassEyeWorkbenchHandle,
  taskId: string,
  terminalTask: MediaProcessingTaskSnapshot,
): Promise<void> => {
  try {
    await persistMediaProcessingTask(workbench, terminalTask);
    mediaProcessingTasks.set(taskId, terminalTask);
  } catch (error) {
    const failed: MediaProcessingTaskSnapshot = {
      ...terminalTask,
      status: "failed",
      updatedAt: new Date().toISOString(),
      record: null,
      downloadsPath: null,
      downloadsPaths: [],
      failureReason: persistenceFailureReason(error),
    };
    mediaProcessingTasks.set(taskId, failed);
    try {
      await persistMediaProcessingTask(workbench, failed);
    } catch {
      return;
    }
  }
};

const stageUploadedMediaFile = async (
  workbench: GrassEyeWorkbenchHandle,
  taskId: string,
  body: MediaProcessingRequestBody,
): Promise<string | null> => {
  const fileName = readString(body.fileName);
  const contentBase64 = readString(body.fileContentBase64);
  if (!fileName || !contentBase64) {
    return null;
  }
  const buffer = Buffer.from(contentBase64, "base64");
  if (buffer.byteLength <= 0 || buffer.byteLength > MEDIA_PROCESSING_UPLOAD_MAX_BYTES) {
    throw new Error("media_processing_upload_size_invalid");
  }
  const uploadDir = path.join(workbench.getDataDir(), "runtime-data", "media-processing-uploads", taskId);
  await mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, safeFileName(fileName));
  await writeFile(filePath, buffer);
  return filePath;
};

const mediaProcessingAllowedInputRoots = (workbench: GrassEyeWorkbenchHandle): readonly string[] => [
  path.join(workbench.getDataDir(), "runtime-data", "media-processing-uploads"),
  path.join(workbench.getDataDir(), "runtime-data", "media-processing-artifacts"),
];

const pathInsideRoot = (filePath: string, root: string): boolean => {
  const relative = path.relative(root, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const assertAllowedMediaProcessingInputPath = async (
  workbench: GrassEyeWorkbenchHandle,
  inputFilePath: string,
): Promise<string> => {
  const resolvedInput = await realpath(inputFilePath);
  const roots = await Promise.all(
    mediaProcessingAllowedInputRoots(workbench).map(async (root) => realpath(root).catch(() => root)),
  );
  if (!roots.some((root) => pathInsideRoot(resolvedInput, root))) {
    throw new Error("media_processing_input_outside_allowed_roots");
  }
  return resolvedInput;
};

const buildMediaProcessingJobInput = async (
  body: MediaProcessingRequestBody,
  workbench: GrassEyeWorkbenchHandle,
  taskId: string,
): Promise<Parameters<typeof routeMediaProcessingArtifactJob>[0] | null> => {
  const childCapabilityId = isMediaProcessingChildId(body.childCapabilityId)
    ? body.childCapabilityId
    : null;
  if (!childCapabilityId) {
    return null;
  }
  const stagedPath = await stageUploadedMediaFile(workbench, taskId, body);
  const requestedInputPath = stagedPath ?? readString(body.inputFilePath);
  const inputFilePath = requestedInputPath
    ? await assertAllowedMediaProcessingInputPath(workbench, requestedInputPath)
    : null;
  if (!inputFilePath) {
    return null;
  }
  const variantWidths = Array.isArray(body.variantWidths)
    ? body.variantWidths.filter((item): item is number => Number.isInteger(item) && item > 0).slice(0, 8)
    : undefined;
  const quality = readPositiveInteger(body.quality);
  const maxWidth = readPositiveInteger(body.maxWidth);
  const maxHeight = readPositiveInteger(body.maxHeight);
  const targetWidth = readPositiveInteger(body.targetWidth);
  const targetHeight = readPositiveInteger(body.targetHeight);
  const posterTimestampSeconds = readNumber(body.posterTimestampSeconds);
  return {
    jobType: "media-processing-artifact",
    childCapabilityId,
    inputFilePath,
    ...(isMediaProcessingPresetId(body.presetId) ? { presetId: body.presetId } : {}),
    ...(isMediaProcessingOutputFormat(body.outputFormat) ? { outputFormat: body.outputFormat } : {}),
    ...(quality ? { quality } : {}),
    ...(maxWidth ? { maxWidth } : {}),
    ...(maxHeight ? { maxHeight } : {}),
    ...(targetWidth ? { targetWidth } : {}),
    ...(targetHeight ? { targetHeight } : {}),
    ...(variantWidths && variantWidths.length > 0 ? { variantWidths } : {}),
    ...(posterTimestampSeconds !== null ? { posterTimestampSeconds } : {}),
    timeoutMs: readPositiveInteger(body.timeoutMs) ?? 120_000,
    artifactPolicy: "deliverable",
  };
};

const buildUserDownloadPath = (filePath: string): string => {
  const extension = path.extname(filePath) || ".bin";
  const title = safeFileName(path.basename(filePath, extension));
  return path.join(homedir(), "Downloads", "GrassEye Media Processing", `${title}-${randomUUID()}${extension}`);
};

const assertWorkbenchDataFile = (workbench: GrassEyeWorkbenchHandle, filePath: string): void => {
  const root = path.join(workbench.getDataDir(), "runtime-data");
  const relative = path.relative(root, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("media_processing_download_outside_workbench_data");
  }
};

const copyResultToDownloads = async (
  result: Awaited<ReturnType<typeof routeMediaProcessingArtifactJob>>,
  workbench: GrassEyeWorkbenchHandle,
  saveToDownloads: boolean,
): Promise<string[]> => {
  if (result.status !== "success" || !saveToDownloads) {
    return [];
  }
  const output = result.result.output.status === "success" ? result.result.output : null;
  const artifacts = output?.outputArtifacts ?? [];
  const copiedPaths: string[] = [];
  for (const artifact of artifacts) {
    assertWorkbenchDataFile(workbench, artifact.filePath);
    const dest = buildUserDownloadPath(artifact.filePath);
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(artifact.filePath, dest);
    copiedPaths.push(dest);
  }
  return copiedPaths;
};

const runMediaProcessingJob = async (
  input: Parameters<typeof routeMediaProcessingArtifactJob>[0],
  body: MediaProcessingRequestBody,
  workbench: GrassEyeWorkbenchHandle,
): Promise<{ record: Awaited<ReturnType<typeof routeMediaProcessingArtifactJob>>; downloadsPath: string | null; downloadsPaths: string[] }> => {
  const result = await routeMediaProcessingArtifactJob(input, workbench);
  const downloadsPaths = await copyResultToDownloads(result, workbench, body.saveToDownloads === true);
  return { record: result, downloadsPath: downloadsPaths[0] ?? null, downloadsPaths };
};

const handleMediaProcessingPresetsRequest = (
  request: IncomingMessage,
  response: ServerResponse,
): boolean => {
  if (request.method !== "GET" || request.url?.split("?")[0] !== "/api/media-processing/presets") {
    return false;
  }
  writeJson(response, 200, {
    presets: [
      { presetId: "web-image", childCapabilityId: "optimize-image-for-web-once", outputFormat: "webp", quality: 82 },
      { presetId: "web-image-responsive", childCapabilityId: "generate-responsive-image-variants-once", outputFormat: "webp", quality: 82, variantWidths: [320, 640, 960, 1280] },
      { presetId: "web-video", childCapabilityId: "optimize-video-for-web-once", outputFormat: "mp4" },
      { presetId: "web-video-compressed", childCapabilityId: "compress-video-for-web-once", outputFormat: "mp4" },
      { presetId: "web-video-poster", childCapabilityId: "generate-video-poster-once", outputFormat: "webp" },
    ],
  });
  return true;
};

const handleMediaProcessingStatusRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  if (request.method !== "GET" || request.url?.split("?")[0] !== "/api/media-processing/status") {
    return false;
  }
  const url = new URL(request.url, "http://127.0.0.1");
  const taskId = url.searchParams.get("taskId") ?? "";
  const task = mediaProcessingTasks.get(taskId);
  if (!task) {
    const persisted = await readPersistedMediaProcessingTask(workbench, taskId);
    if (persisted) {
      writeJson(response, 200, persisted);
      return true;
    }
    writeJson(response, 404, { error: "media_processing_task_not_found" });
    return true;
  }
  writeJson(response, 200, task);
  return true;
};

const handleMediaProcessingAsyncStartRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  if (request.method !== "POST" || request.url?.split("?")[0] !== "/api/media-processing/start-async") {
    return false;
  }
  if (runningTaskCount() >= MEDIA_PROCESSING_MAX_RUNNING_TASKS) {
    writeJson(response, 429, { error: "media_processing_concurrency_limit_reached" });
    return true;
  }
  const body = await readJsonBody(request) as MediaProcessingRequestBody;
  const taskId = `media_processing_${randomUUID()}`;
  let input: Parameters<typeof routeMediaProcessingArtifactJob>[0] | null;
  try {
    input = await buildMediaProcessingJobInput(body, workbench, taskId);
  } catch (error) {
    writeJson(response, 400, {
      error: error instanceof Error ? error.message : "invalid_media_processing_input",
    });
    return true;
  }
  if (!input) {
    writeJson(response, 400, { error: "invalid_media_processing_input" });
    return true;
  }
  const now = new Date().toISOString();
  const initialTask: MediaProcessingTaskSnapshot = {
    taskId,
    status: "running",
    startedAt: now,
    updatedAt: now,
    childCapabilityId: input.childCapabilityId,
    sourceFileName: path.basename(input.inputFilePath),
    record: null,
    downloadsPath: null,
    downloadsPaths: [],
    failureReason: null,
  };
  mediaProcessingTasks.set(taskId, initialTask);
  try {
    await persistMediaProcessingTask(workbench, initialTask);
  } catch (error) {
    const failed: MediaProcessingTaskSnapshot = {
      ...initialTask,
      status: "failed",
      updatedAt: new Date().toISOString(),
      failureReason: persistenceFailureReason(error),
    };
    mediaProcessingTasks.set(taskId, failed);
    writeJson(response, 500, failed);
    return true;
  }
  void runMediaProcessingJob(input, body, workbench)
    .then(async ({ record, downloadsPath, downloadsPaths }) => {
      const current = mediaProcessingTasks.get(taskId);
      if (!current) return;
      const completed: MediaProcessingTaskSnapshot = {
        ...current,
        status: record.status,
        updatedAt: new Date().toISOString(),
        record,
        downloadsPath,
        downloadsPaths,
        failureReason: record.result.failureReason ?? record.result.reviewRequiredReason ?? null,
      };
      await persistTerminalMediaProcessingTask(workbench, taskId, completed);
    })
    .catch((error) => {
      const current = mediaProcessingTasks.get(taskId);
      if (!current) return;
      const failed: MediaProcessingTaskSnapshot = {
        ...current,
        status: "failed",
        updatedAt: new Date().toISOString(),
        failureReason: error instanceof Error ? error.message : String(error),
      };
      void persistTerminalMediaProcessingTask(workbench, taskId, failed);
    });
  writeJson(response, 202, mediaProcessingTasks.get(taskId));
  return true;
};

const handleMediaProcessingDownloadRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  if (request.method !== "POST" || request.url?.split("?")[0] !== "/api/media-processing/download") {
    return false;
  }
  const body = await readJsonBody(request) as { filePath?: unknown };
  const filePath = readString(body.filePath);
  if (!filePath) {
    writeJson(response, 400, { error: "missing_media_processing_file_path" });
    return true;
  }
  assertWorkbenchDataFile(workbench, filePath);
  await stat(filePath);
  const dest = buildUserDownloadPath(filePath);
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(filePath, dest);
  writeJson(response, 200, { downloadsPath: dest });
  return true;
};

export const handleMediaProcessingRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  if (handleMediaProcessingPresetsRequest(request, response)) {
    return true;
  }
  if (await handleMediaProcessingStatusRequest(request, response, workbench)) {
    return true;
  }
  if (await handleMediaProcessingAsyncStartRequest(request, response, workbench)) {
    return true;
  }
  return handleMediaProcessingDownloadRequest(request, response, workbench);
};
