import { copyFile, mkdir, realpath, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir } from "node:os";
import path from "node:path";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { routeMediaProcessingArtifactJob } from "../mediator/media-processing-artifact-route.js";
import { readJsonBody, writeJson } from "./workbench-http.js";
import {
  buildInitialMediaProcessingTask,
  mediaProcessingTasks,
  persistMediaProcessingTask,
  persistenceFailureReason,
  persistTerminalMediaProcessingTask,
  readPersistedMediaProcessingTask,
  runningTaskCount,
  type MediaProcessingJobInput,
  type MediaProcessingTaskSnapshot,
} from "./workbench-media-processing-task-store.js";

const MEDIA_PROCESSING_OUTPUT_FORMATS = ["webp", "jpeg", "png", "mp4"] as const;
const MEDIA_PROCESSING_PRESETS = [
  "web-image",
  "web-image-responsive",
  "web-video",
  "web-video-compressed",
  "web-video-poster",
] as const;

type MediaProcessingOutputFormat = typeof MEDIA_PROCESSING_OUTPUT_FORMATS[number];
type MediaProcessingPresetId = typeof MEDIA_PROCESSING_PRESETS[number];

type MediaProcessingRequestBody = {
  inputFilePath?: unknown;
  fileName?: unknown;
  fileContentBase64?: unknown;
  presetId?: unknown;
  outputFormat?: unknown;
  quality?: unknown;
  maxWidth?: unknown;
  maxHeight?: unknown;
  targetWidth?: unknown;
  targetHeight?: unknown;
  variantWidths?: unknown;
  posterTimestampSeconds?: unknown;
  targetMaxBytes?: unknown;
  targetBitrateKbps?: unknown;
  timeoutMs?: unknown;
  saveToDownloads?: unknown;
};

const MEDIA_PROCESSING_MAX_RUNNING_TASKS = 2;
const MEDIA_PROCESSING_UPLOAD_MAX_BYTES = 50_000_000;

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

const readVariantWidths = (value: unknown): number[] | undefined =>
  Array.isArray(value)
    ? value.filter((item): item is number => Number.isInteger(item) && item > 0).slice(0, 8)
    : undefined;

const assignPositiveIntegerOption = (
  options: Partial<MediaProcessingJobInput>,
  key: "quality" | "maxWidth" | "maxHeight" | "targetWidth" | "targetHeight" | "targetMaxBytes" | "targetBitrateKbps",
  value: unknown,
): void => {
  const parsed = readPositiveInteger(value);
  if (parsed) {
    options[key] = parsed;
  }
};

const buildMediaProcessingJobOptions = (body: MediaProcessingRequestBody): Partial<MediaProcessingJobInput> => {
  const variantWidths = readVariantWidths(body.variantWidths);
  const posterTimestampSeconds = readNumber(body.posterTimestampSeconds);
  const options: Partial<MediaProcessingJobInput> = {};
  if (isMediaProcessingPresetId(body.presetId)) options.presetId = body.presetId;
  if (isMediaProcessingOutputFormat(body.outputFormat)) options.outputFormat = body.outputFormat;
  assignPositiveIntegerOption(options, "quality", body.quality);
  assignPositiveIntegerOption(options, "maxWidth", body.maxWidth);
  assignPositiveIntegerOption(options, "maxHeight", body.maxHeight);
  assignPositiveIntegerOption(options, "targetWidth", body.targetWidth);
  assignPositiveIntegerOption(options, "targetHeight", body.targetHeight);
  assignPositiveIntegerOption(options, "targetMaxBytes", body.targetMaxBytes);
  assignPositiveIntegerOption(options, "targetBitrateKbps", body.targetBitrateKbps);
  if (variantWidths && variantWidths.length > 0) options.variantWidths = variantWidths;
  if (posterTimestampSeconds !== null) options.posterTimestampSeconds = posterTimestampSeconds;
  return options;
};

const buildMediaProcessingJobInput = async (
  body: MediaProcessingRequestBody,
  workbench: GrassEyeWorkbenchHandle,
  taskId: string,
): Promise<MediaProcessingJobInput | null> => {
  const presetId = isMediaProcessingPresetId(body.presetId)
    ? body.presetId
    : null;
  if (!presetId) {
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
  return {
    jobType: "media-processing-artifact",
    presetId,
    inputFilePath,
    ...buildMediaProcessingJobOptions(body),
    timeoutMs: readPositiveInteger(body.timeoutMs) ?? 120_000,
    artifactPolicy: "deliverable",
  };
};

const buildUserDownloadPath = (filePath: string, deliveryDirectory?: string): string => {
  const extension = path.extname(filePath) || ".bin";
  const title = safeFileName(path.basename(filePath, extension));
  const root = deliveryDirectory ?? path.join(homedir(), "Downloads", "GrassEye Media Processing");
  return path.join(root, `${title}-${randomUUID()}${extension}`);
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
  deliveryDirectory?: string,
): Promise<string[]> => {
  if (result.status !== "success" || !saveToDownloads) {
    return [];
  }
  const output = result.result.output.status === "success" ? result.result.output : null;
  const artifacts = output?.outputArtifacts ?? [];
  const copiedPaths: string[] = [];
  for (const artifact of artifacts) {
    assertWorkbenchDataFile(workbench, artifact.filePath);
    const dest = buildUserDownloadPath(artifact.filePath, deliveryDirectory);
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
  deliveryDirectory?: string,
): Promise<{ record: Awaited<ReturnType<typeof routeMediaProcessingArtifactJob>>; downloadsPaths: string[] }> => {
  const result = await routeMediaProcessingArtifactJob(input, {
    mediaProcessing: workbench.getMediaProcessingAbilityGroup(),
  });
  const downloadsPaths = await copyResultToDownloads(result, workbench, body.saveToDownloads === true, deliveryDirectory);
  return { record: result, downloadsPaths };
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
      { presetId: "web-image", outputFormat: "webp", quality: 82 },
      { presetId: "web-image-responsive", outputFormat: "webp", quality: 82, variantWidths: [320, 640, 960, 1280] },
      { presetId: "web-video", outputFormat: "mp4" },
      { presetId: "web-video-compressed", outputFormat: "mp4", targetBitrateKbps: 1200 },
      { presetId: "web-video-poster", outputFormat: "webp" },
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

const writePersistStartFailure = (
  response: ServerResponse,
  task: MediaProcessingTaskSnapshot,
  error: unknown,
): void => {
  const failed: MediaProcessingTaskSnapshot = {
    ...task,
    status: "failed",
    updatedAt: new Date().toISOString(),
    failureReason: persistenceFailureReason(error),
  };
  mediaProcessingTasks.set(task.taskId, failed);
  writeJson(response, 500, failed);
};

const persistCompletedMediaProcessingTask = async (
  workbench: GrassEyeWorkbenchHandle,
  taskId: string,
  output: Awaited<ReturnType<typeof runMediaProcessingJob>>,
): Promise<void> => {
  const current = mediaProcessingTasks.get(taskId);
  if (!current) return;
  const completed: MediaProcessingTaskSnapshot = {
    ...current,
    status: output.record.status,
    updatedAt: new Date().toISOString(),
    record: output.record,
    downloadsPaths: output.downloadsPaths,
    failureReason: output.record.result.failureReason ?? output.record.result.reviewRequiredReason ?? null,
  };
  await persistTerminalMediaProcessingTask(workbench, taskId, completed);
};

const persistFailedMediaProcessingTask = (
  workbench: GrassEyeWorkbenchHandle,
  taskId: string,
  error: unknown,
): void => {
  const current = mediaProcessingTasks.get(taskId);
  if (!current) return;
  const failed: MediaProcessingTaskSnapshot = {
    ...current,
    status: "failed",
    updatedAt: new Date().toISOString(),
    failureReason: error instanceof Error ? error.message : String(error),
  };
  void persistTerminalMediaProcessingTask(workbench, taskId, failed);
};

const runMediaProcessingJobInBackground = (
  input: MediaProcessingJobInput,
  body: MediaProcessingRequestBody,
  workbench: GrassEyeWorkbenchHandle,
  taskId: string,
  deliveryDirectory?: string,
): void => {
  void runMediaProcessingJob(input, body, workbench, deliveryDirectory)
    .then((output) => persistCompletedMediaProcessingTask(workbench, taskId, output))
    .catch((error) => persistFailedMediaProcessingTask(workbench, taskId, error));
};

const handleMediaProcessingAsyncStartRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  deliveryDirectory?: string,
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
  let input: MediaProcessingJobInput | null;
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
  const initialTask = buildInitialMediaProcessingTask(taskId, input);
  mediaProcessingTasks.set(taskId, initialTask);
  try {
    await persistMediaProcessingTask(workbench, initialTask);
  } catch (error) {
    writePersistStartFailure(response, initialTask, error);
    return true;
  }
  runMediaProcessingJobInBackground(input, body, workbench, taskId, deliveryDirectory);
  writeJson(response, 202, mediaProcessingTasks.get(taskId));
  return true;
};

const handleMediaProcessingDownloadRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  deliveryDirectory?: string,
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
  const dest = buildUserDownloadPath(filePath, deliveryDirectory);
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(filePath, dest);
  writeJson(response, 200, { downloadsPath: dest });
  return true;
};

export const handleMediaProcessingRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  deliveryDirectory?: string,
): Promise<boolean> => {
  if (handleMediaProcessingPresetsRequest(request, response)) {
    return true;
  }
  if (await handleMediaProcessingStatusRequest(request, response, workbench)) {
    return true;
  }
  if (await handleMediaProcessingAsyncStartRequest(request, response, workbench, deliveryDirectory)) {
    return true;
  }
  return handleMediaProcessingDownloadRequest(request, response, workbench, deliveryDirectory);
};
