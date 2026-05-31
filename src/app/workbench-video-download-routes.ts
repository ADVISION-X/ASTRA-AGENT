import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir } from "node:os";
import path from "node:path";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { routeVideoDownloadArtifactJob } from "../mediator/video-download-artifact-route.js";
import { readJsonBody, writeJson } from "./workbench-http.js";

const VIDEO_DOWNLOAD_PLATFORMS = [
  "universal",
  "facebook",
  "tiktok",
  "instagram",
  "bilibili",
  "douyin",
  "x",
  "xiaohongshu",
  "youtube",
  "telegram-web",
] as const;

const VIDEO_DOWNLOAD_QUALITIES = [
  "2160p",
  "1440p",
  "1080p",
  "720p",
  "480p",
  "360p",
  "hd",
  "sd",
  "best_available",
] as const;

type VideoDownloadPlatform = typeof VIDEO_DOWNLOAD_PLATFORMS[number];
type VideoDownloadQuality = typeof VIDEO_DOWNLOAD_QUALITIES[number];

type VideoDownloadRequestBody = {
  sourcePageUrl?: unknown;
  platform?: unknown;
  preferredQuality?: unknown;
  maxBytes?: unknown;
  timeoutMs?: unknown;
  downloadSubtitles?: unknown;
  saveToDownloads?: unknown;
  subtitleLanguages?: unknown;
  telegramDocumentIdHash?: unknown;
};

type VideoDownloadSourcePlatform = "telegram-web";

type VideoDownloadTaskSnapshot = {
  taskId: string;
  status: "running" | "success" | "failed" | "review_required" | "invalid_input";
  startedAt: string;
  updatedAt: string;
  platform: VideoDownloadPlatform;
  sourcePageUrl: string;
  record: Awaited<ReturnType<typeof routeVideoDownloadArtifactJob>> | null;
  downloadsPath: string | null;
  failureReason: string | null;
};

const videoDownloadTasks = new Map<string, VideoDownloadTaskSnapshot>();
const VIDEO_DOWNLOAD_TASK_TTL_MS = 24 * 60 * 60 * 1000;
const VIDEO_DOWNLOAD_MAX_RUNNING_TASKS = 2;
const YOUTUBE_DEFAULT_MAX_BYTES = 5_000_000_000;
const VIDEO_DOWNLOAD_TASK_PERSISTENCE_FAILED = "video_download_task_persistence_failed";

const isVideoDownloadPlatform = (value: unknown): value is VideoDownloadPlatform =>
  typeof value === "string" && VIDEO_DOWNLOAD_PLATFORMS.some((platform) => platform === value);

const isVideoDownloadQuality = (value: unknown): value is VideoDownloadQuality =>
  typeof value === "string" && VIDEO_DOWNLOAD_QUALITIES.some((quality) => quality === value);

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const readPositiveInteger = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;

const readSubtitleLanguages = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 8)
    : ["en"];

const isTelegramDocumentIdHash = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length === 24 &&
  [...value].every((char) => char >= "0" && char <= "9" || char >= "a" && char <= "f");

const taskStoreDir = (workbench: GrassEyeWorkbenchHandle): string =>
  path.join(workbench.getDataDir(), "runtime-data", "video-download-tasks");

const taskStorePath = (workbench: GrassEyeWorkbenchHandle, taskId: string): string =>
  path.join(taskStoreDir(workbench), `${taskId}.json`);

const persistVideoDownloadTask = async (
  workbench: GrassEyeWorkbenchHandle,
  task: VideoDownloadTaskSnapshot,
): Promise<void> => {
  await mkdir(taskStoreDir(workbench), { recursive: true });
  const destination = taskStorePath(workbench, task.taskId);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(task, null, 2)}\n`);
  await rename(temporary, destination);
};

const readPersistedVideoDownloadTask = async (
  workbench: GrassEyeWorkbenchHandle,
  taskId: string,
): Promise<VideoDownloadTaskSnapshot | null> => {
  try {
    const parsed = JSON.parse(await readFile(taskStorePath(workbench, taskId), "utf8")) as VideoDownloadTaskSnapshot;
    if (parsed.taskId !== taskId) return null;
    return parsed.status === "running"
      ? {
          ...parsed,
          status: "failed",
          updatedAt: new Date().toISOString(),
          failureReason: "video_download_task_interrupted_before_completion",
        }
      : parsed;
  } catch {
    return null;
  }
};

const pruneVideoDownloadTasks = (): void => {
  const now = Date.now();
  for (const [taskId, task] of videoDownloadTasks) {
    if (now - Date.parse(task.updatedAt) > VIDEO_DOWNLOAD_TASK_TTL_MS) {
      videoDownloadTasks.delete(taskId);
    }
  }
};

const runningTaskCount = (): number => {
  pruneVideoDownloadTasks();
  return [...videoDownloadTasks.values()].filter((task) => task.status === "running").length;
};

export const safeDeliveryTitleSegment = (value: string): string => {
  const cleaned = [...value.trim()]
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code < 32 || char === "/" || char === "\\" || char === ":" || char === "*" || char === "?" || char === "\"" || char === "<" || char === ">" || char === "|") {
        return " ";
      }
      return char;
    })
    .join("")
    .split(" ")
    .filter((part) => part.length > 0)
    .join(" ")
    .slice(0, 120)
    .trim();
  return cleaned || "YouTube video";
};

const buildUserDownloadPath = (filePath: string, displayTitle: string | null): string => {
  const extension = path.extname(filePath) || ".mp4";
  const title = safeDeliveryTitleSegment(displayTitle ?? path.basename(filePath, extension));
  return path.join(homedir(), "Downloads", "GrassEye Video Downloads", `${title}-${randomUUID()}${extension}`);
};

const buildVideoDownloadJobInputForPlatform = (
  body: VideoDownloadRequestBody,
  platform: VideoDownloadPlatform,
  sourcePageUrl: string,
): Parameters<typeof routeVideoDownloadArtifactJob>[0] => {
  return {
    jobType: "video-download-artifact",
    platform,
    sourcePageUrl,
    preferredQuality: isVideoDownloadQuality(body.preferredQuality)
      ? body.preferredQuality
      : "best_available",
    maxBytes: Math.min(readPositiveInteger(body.maxBytes) ?? YOUTUBE_DEFAULT_MAX_BYTES, YOUTUBE_DEFAULT_MAX_BYTES),
    timeoutMs: readPositiveInteger(body.timeoutMs) ?? 3_600_000,
    downloadSubtitles: body.downloadSubtitles === true,
    subtitleLanguages: readSubtitleLanguages(body.subtitleLanguages),
    ...(isTelegramDocumentIdHash(body.telegramDocumentIdHash)
      ? { telegramDocumentIdHash: body.telegramDocumentIdHash }
      : {}),
  };
};

export const buildVideoDownloadJobInput = (body: VideoDownloadRequestBody): Parameters<typeof routeVideoDownloadArtifactJob>[0] | null => {
  const sourcePageUrl = readString(body.sourcePageUrl);
  const platform = isVideoDownloadPlatform(body.platform)
    ? body.platform
    : "universal";
  if (!sourcePageUrl) {
    return null;
  }
  return buildVideoDownloadJobInputForPlatform(body, platform, sourcePageUrl);
};

export const copyResultToDownloads = async (
  result: Awaited<ReturnType<typeof routeVideoDownloadArtifactJob>>,
  saveToDownloads: boolean,
): Promise<string | null> => {
  if (result.status !== "success" || !saveToDownloads) {
    return null;
  }
  const output = result.result.output as Record<string, unknown>;
  const filePath = typeof output.filePath === "string" ? output.filePath : null;
  const displayTitle = typeof output.displayTitle === "string" ? output.displayTitle : null;
  if (!filePath) {
    return null;
  }
  const dest = buildUserDownloadPath(filePath, displayTitle);
  await mkdir(path.dirname(dest), { recursive: true });
  try {
    await stat(dest);
    throw new Error(`Download destination already exists: ${dest}`);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }
  await copyFile(filePath, dest);
  return dest;
};

const runVideoDownloadJob = async (
  input: Parameters<typeof routeVideoDownloadArtifactJob>[0],
  body: VideoDownloadRequestBody,
  workbench: GrassEyeWorkbenchHandle,
): Promise<{ record: Awaited<ReturnType<typeof routeVideoDownloadArtifactJob>>; downloadsPath: string | null }> => {
  const result = await routeVideoDownloadArtifactJob(input, workbench);
  const downloadsPath = await copyResultToDownloads(result, body.saveToDownloads !== false);
  return { record: result, downloadsPath };
};

const persistenceFailureReason = (error: unknown): string =>
  `${VIDEO_DOWNLOAD_TASK_PERSISTENCE_FAILED}: ${error instanceof Error ? error.message : String(error)}`;

export const persistTerminalVideoDownloadTask = async (
  workbench: GrassEyeWorkbenchHandle,
  taskId: string,
  terminalTask: VideoDownloadTaskSnapshot,
): Promise<VideoDownloadTaskSnapshot> => {
  try {
    await persistVideoDownloadTask(workbench, terminalTask);
    videoDownloadTasks.set(taskId, terminalTask);
    return terminalTask;
  } catch (error) {
    const failed: VideoDownloadTaskSnapshot = {
      ...terminalTask,
      status: "failed",
      updatedAt: new Date().toISOString(),
      record: null,
      downloadsPath: null,
      failureReason: persistenceFailureReason(error),
    };
    videoDownloadTasks.set(taskId, failed);
    try {
      await persistVideoDownloadTask(workbench, failed);
    } catch (secondError) {
      const doubleFailed = {
        ...failed,
        failureReason: `${failed.failureReason}; failed_snapshot_persist_failed: ${secondError instanceof Error ? secondError.message : String(secondError)}`,
      };
      videoDownloadTasks.set(taskId, doubleFailed);
      return doubleFailed;
    }
    return failed;
  }
};

const readSourcePlatform = (value: string | null): VideoDownloadSourcePlatform | null =>
  value === "telegram-web" ? value : null;

const handleVideoDownloadSourcePageRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  if (request.method !== "GET" || request.url?.split("?")[0] !== "/api/video-download/source-page") {
    return false;
  }
  const url = new URL(request.url, "http://127.0.0.1");
  const platformId = readSourcePlatform(url.searchParams.get("platform"));
  if (!platformId) {
    writeJson(response, 400, { error: "unsupported_video_source_platform" });
    return true;
  }
  const preferredSourcePageUrl = readString(url.searchParams.get("sourcePageUrl"));
  const sourcePage = await workbench.findOpenVideoDownloadSourcePage(platformId, preferredSourcePageUrl ?? undefined);
  if (!sourcePage) {
    writeJson(response, 404, { error: "source_page_not_found", platformId });
    return true;
  }
  writeJson(response, 200, sourcePage);
  return true;
};

const handleVideoDownloadStatusRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  if (request.method !== "GET" || request.url?.split("?")[0] !== "/api/video-download/status") {
    return false;
  }
  const url = new URL(request.url, "http://127.0.0.1");
  const taskId = url.searchParams.get("taskId") ?? "";
  const task = videoDownloadTasks.get(taskId);
  if (!task) {
    const persisted = await readPersistedVideoDownloadTask(workbench, taskId);
    if (persisted) {
      writeJson(response, 200, persisted);
      return true;
    }
    writeJson(response, 404, { error: "video_download_task_not_found" });
    return true;
  }
  writeJson(response, 200, task);
  return true;
};

const handleVideoDownloadAsyncStartRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  if (request.method !== "POST" || request.url?.split("?")[0] !== "/api/video-download/start-async") {
    return false;
  }
  const body = await readJsonBody(request) as VideoDownloadRequestBody;
  const input = buildVideoDownloadJobInput(body);
  if (!input) {
    writeJson(response, 400, { error: "missing_source_page_url" });
    return true;
  }
  if (runningTaskCount() >= VIDEO_DOWNLOAD_MAX_RUNNING_TASKS) {
    writeJson(response, 429, { error: "video_download_concurrency_limit_reached" });
    return true;
  }
  const now = new Date().toISOString();
  const taskId = `video_download_${randomUUID()}`;
  const initialTask: VideoDownloadTaskSnapshot = {
    taskId,
    status: "running",
    startedAt: now,
    updatedAt: now,
    platform: input.platform ?? "universal",
    sourcePageUrl: input.sourcePageUrl,
    record: null,
    downloadsPath: null,
    failureReason: null,
  };
  videoDownloadTasks.set(taskId, initialTask);
  try {
    await persistVideoDownloadTask(workbench, initialTask);
  } catch (error) {
    const failed: VideoDownloadTaskSnapshot = {
      ...initialTask,
      status: "failed",
      updatedAt: new Date().toISOString(),
      failureReason: persistenceFailureReason(error),
    };
    videoDownloadTasks.set(taskId, failed);
    writeJson(response, 500, failed);
    return true;
  }
  void runVideoDownloadJob(input, body, workbench)
    .then(async ({ record, downloadsPath }) => {
      const current = videoDownloadTasks.get(taskId);
      if (!current) return;
      const completed: VideoDownloadTaskSnapshot = {
        ...current,
        status: record.status,
        updatedAt: new Date().toISOString(),
        record,
        downloadsPath,
        failureReason: record.result.failureReason ?? record.result.reviewRequiredReason ?? null,
      };
      await persistTerminalVideoDownloadTask(workbench, taskId, completed);
    })
    .catch((error) => {
      const current = videoDownloadTasks.get(taskId);
      if (!current) return;
      const failed: VideoDownloadTaskSnapshot = {
        ...current,
        status: "failed",
        updatedAt: new Date().toISOString(),
        failureReason: error instanceof Error ? error.message : String(error),
      };
      void persistTerminalVideoDownloadTask(workbench, taskId, failed);
    });
  writeJson(response, 202, videoDownloadTasks.get(taskId));
  return true;
};

export const handleVideoDownloadRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  if (await handleVideoDownloadSourcePageRequest(request, response, workbench)) {
    return true;
  }
  if (await handleVideoDownloadStatusRequest(request, response, workbench)) {
    return true;
  }
  if (await handleVideoDownloadAsyncStartRequest(request, response, workbench)) {
    return true;
  }
  if (request.method !== "POST" || request.url?.split("?")[0] !== "/api/video-download/start") {
    return false;
  }
  const body = await readJsonBody(request) as VideoDownloadRequestBody;
  const input = buildVideoDownloadJobInput(body);
  if (!input) {
    writeJson(response, 400, { error: "missing_source_page_url" });
    return true;
  }
  if (input.platform === "youtube") {
    writeJson(response, 409, {
      error: "youtube_requires_async_status_route",
      asyncRoute: "/api/video-download/start-async",
      statusRoute: "/api/video-download/status",
    });
    return true;
  }
  try {
    const result = await runVideoDownloadJob(input, body, workbench);
    writeJson(response, 200, result);
  } catch (error) {
    writeJson(response, 500, {
      error: "video_download_delivery_failed",
      failureReason: error instanceof Error ? error.message : String(error),
    });
  }
  return true;
};
