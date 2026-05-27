import { copyFile } from "node:fs/promises";
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
  telegramDocumentIdHash?: unknown;
};

type VideoDownloadSourcePlatform = "telegram-web";

const isVideoDownloadPlatform = (value: unknown): value is VideoDownloadPlatform =>
  typeof value === "string" && VIDEO_DOWNLOAD_PLATFORMS.some((platform) => platform === value);

const isVideoDownloadQuality = (value: unknown): value is VideoDownloadQuality =>
  typeof value === "string" && VIDEO_DOWNLOAD_QUALITIES.some((quality) => quality === value);

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const readPositiveInteger = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;

const buildVideoDownloadJobInputForPlatform = (
  body: VideoDownloadRequestBody,
  platform: VideoDownloadPlatform,
  sourcePageUrl: string,
): Parameters<typeof routeVideoDownloadArtifactJob>[0] => ({
  jobType: "video-download-artifact",
  platform,
  sourcePageUrl,
  preferredQuality: isVideoDownloadQuality(body.preferredQuality) ? body.preferredQuality : "best_available",
  maxBytes: readPositiveInteger(body.maxBytes) ?? 5_000_000_000,
  timeoutMs: readPositiveInteger(body.timeoutMs) ?? 3_600_000,
  downloadSubtitles: body.downloadSubtitles === true,
  subtitleLanguages: ["en"],
  ...(typeof body.telegramDocumentIdHash === "string" && /^[a-f0-9]{24}$/u.test(body.telegramDocumentIdHash)
    ? { telegramDocumentIdHash: body.telegramDocumentIdHash }
    : {}),
});

const buildVideoDownloadJobInput = (body: VideoDownloadRequestBody): Parameters<typeof routeVideoDownloadArtifactJob>[0] | null => {
  const sourcePageUrl = readString(body.sourcePageUrl);
  const platform = isVideoDownloadPlatform(body.platform)
    ? body.platform
    : "universal";
  if (!sourcePageUrl) {
    return null;
  }
  return buildVideoDownloadJobInputForPlatform(body, platform, sourcePageUrl);
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

export const handleVideoDownloadRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
): Promise<boolean> => {
  if (await handleVideoDownloadSourcePageRequest(request, response, workbench)) {
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
  const result = await routeVideoDownloadArtifactJob(input, workbench);
  let downloadsPath: string | null = null;
  if (result.status === "success" && body.saveToDownloads === true) {
    const output = result.result.output as Record<string, unknown>;
    const filePath = typeof output.filePath === "string" ? output.filePath : null;
    if (filePath) {
      const dest = path.join(homedir(), "Downloads", path.basename(filePath));
      try {
        await copyFile(filePath, dest);
        downloadsPath = dest;
      } catch {
        // best-effort: copy failure does not fail the job
      }
    }
  }
  writeJson(response, 200, { record: result, downloadsPath });
  return true;
};
