import { copyFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir } from "node:os";
import path from "node:path";
import { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { routeVideoDownloadArtifactJob } from "../mediator/video-download-artifact-route.js";
import { readJsonBody, writeJson } from "./workbench-http.js";

const VIDEO_DOWNLOAD_CHILD_IDS = [
  "download-web-video-once",
  "download-facebook-video-once",
  "download-tiktok-video-once",
  "download-instagram-video-once",
  "download-bilibili-video-once",
  "download-douyin-video-once",
  "download-x-video-once",
  "download-xiaohongshu-video-once",
  "download-youtube-video-once",
  "download-telegram-web-video-once",
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

type VideoDownloadChildId = typeof VIDEO_DOWNLOAD_CHILD_IDS[number];
type VideoDownloadQuality = typeof VIDEO_DOWNLOAD_QUALITIES[number];

type VideoDownloadRequestBody = {
  sourcePageUrl?: unknown;
  childCapabilityId?: unknown;
  preferredQuality?: unknown;
  maxBytes?: unknown;
  timeoutMs?: unknown;
  downloadSubtitles?: unknown;
  saveToDownloads?: unknown;
};

type VideoDownloadSourcePlatform = "telegram-web";

const isVideoDownloadChildId = (value: unknown): value is VideoDownloadChildId =>
  typeof value === "string" && VIDEO_DOWNLOAD_CHILD_IDS.some((childId) => childId === value);

const isVideoDownloadQuality = (value: unknown): value is VideoDownloadQuality =>
  typeof value === "string" && VIDEO_DOWNLOAD_QUALITIES.some((quality) => quality === value);

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const readPositiveInteger = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;

const buildVideoDownloadJobInputForChild = (
  body: VideoDownloadRequestBody,
  childCapabilityId: VideoDownloadChildId,
  sourcePageUrl: string,
): Parameters<typeof routeVideoDownloadArtifactJob>[0] => ({
  jobType: "video-download-artifact",
  childCapabilityId,
  sourcePageUrl,
  preferredQuality: isVideoDownloadQuality(body.preferredQuality) ? body.preferredQuality : "best_available",
  maxBytes: readPositiveInteger(body.maxBytes) ?? 200_000_000,
  timeoutMs: readPositiveInteger(body.timeoutMs) ?? 60_000,
  downloadSubtitles: body.downloadSubtitles === true,
  subtitleLanguages: ["en"],
});

const buildVideoDownloadJobInput = (body: VideoDownloadRequestBody): Parameters<typeof routeVideoDownloadArtifactJob>[0] | null => {
  const sourcePageUrl = readString(body.sourcePageUrl);
  const childCapabilityId = isVideoDownloadChildId(body.childCapabilityId)
    ? body.childCapabilityId
    : "download-web-video-once";
  if (!sourcePageUrl) {
    return null;
  }
  return buildVideoDownloadJobInputForChild(body, childCapabilityId, sourcePageUrl);
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
  const sourcePage = await workbench.findOpenVideoDownloadSourcePage(platformId);
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
