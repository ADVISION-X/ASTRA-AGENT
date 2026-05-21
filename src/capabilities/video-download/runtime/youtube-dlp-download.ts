import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import YTDlpWrapModule from "yt-dlp-wrap/dist/index.js";

import type { ParsedVideoDownloadAbilityInput } from "../schema.js";
import { extractYoutubeVideoId, normalizeYoutubeVideoUrl } from "./youtube-url.js";
import { resolveYtDlpBinaryPath } from "./youtube-dlp-binary.js";
import { formatSelector, subtitleArgs, youtubeArgs } from "./youtube-dlp-args.js";
import { collectYtDlpOutputFiles, type YoutubeSubtitleDownload } from "./youtube-dlp-output.js";

type YTDlpWrapInstance = {
  execPromise(args: string[], options?: { maxBuffer?: number }, abortSignal?: AbortSignal): Promise<string>;
};

type YTDlpWrapRuntime = new (binaryPath: string) => YTDlpWrapInstance;

const unwrapDefaultExport = (value: unknown): unknown => {
  const record = value && typeof value === "object" ? value as { default?: unknown } : null;
  return record?.default ?? value;
};

const resolveYTDlpWrapRuntime = (value: unknown): YTDlpWrapRuntime => {
  const runtimeValue = unwrapDefaultExport(value);
  if (!runtimeValue || typeof runtimeValue !== "function") {
    throw new Error("yt-dlp-wrap runtime is not constructable.");
  }
  return runtimeValue as YTDlpWrapRuntime;
};

const YTDlpWrapRuntime = resolveYTDlpWrapRuntime(YTDlpWrapModule);

type YoutubeMetadata = {
  id: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
};

export type YoutubeDownloadSuccess = {
  ok: true;
  bytes: Uint8Array;
  contentType: string;
  byteSize: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  videoId: string | null;
  subtitles: YoutubeSubtitleDownload[];
};

export type YoutubeDownloadFailure = {
  ok: false;
  reason: string;
  reviewRequired: boolean;
};

export type YoutubeDownloadResult = YoutubeDownloadSuccess | YoutubeDownloadFailure;

const numberField = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

const stringField = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const metadataFromJson = (raw: unknown): YoutubeMetadata => {
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const seconds = numberField(record.duration);
  return {
    id: stringField(record.id),
    durationMs: seconds === null ? null : Math.round(seconds * 1000),
    width: numberField(record.width),
    height: numberField(record.height),
    fileSize: numberField(record.filesize) ?? numberField(record.filesize_approx),
  };
};

const timeoutSeconds = (input: ParsedYoutubeInput, metadata: YoutubeMetadata): number => {
  if (!metadata.fileSize || metadata.fileSize <= 0) {
    return Math.max(30, Math.ceil(input.timeoutMs / 1000));
  }
  const sizeMb = metadata.fileSize / (1024 * 1024);
  return Math.max(300, Math.min(3600, Math.ceil(300 + sizeMb * 3)));
};

type ParsedYoutubeInput = Extract<
  ParsedVideoDownloadAbilityInput,
  { childCapabilityId: "download-youtube-video-once" }
>;

const readMetadata = async (
  wrapper: YTDlpWrapInstance,
  url: string,
  abortSignal: AbortSignal,
): Promise<YoutubeMetadata> => {
  const stdout = await wrapper.execPromise([
    "--dump-json",
    "--no-warnings",
    ...youtubeArgs(url),
  ], { maxBuffer: 10 * 1024 * 1024 }, abortSignal);
  return metadataFromJson(JSON.parse(stdout) as unknown);
};

const classifyFailure = (error: unknown): YoutubeDownloadFailure => {
  const message = error instanceof Error ? error.message : "Unknown YouTube download failure.";
  const lower = message.toLowerCase();
  const reviewRequired = [
    "private video",
    "sign in",
    "login",
    "captcha",
    "confirm your age",
    "drm",
    "members-only",
    "this video is unavailable",
  ].some((needle) => lower.includes(needle));
  return { ok: false, reason: message, reviewRequired };
};

const runYoutubeDownload = async (input: {
  request: ParsedYoutubeInput;
  abortSignal: AbortSignal;
  tempDir: string;
  normalizedUrl: string;
}): Promise<{
  metadata: YoutubeMetadata;
  output: Awaited<ReturnType<typeof collectYtDlpOutputFiles>>;
}> => {
  const wrapper = new YTDlpWrapRuntime(await resolveYtDlpBinaryPath());
  const metadata = await readMetadata(wrapper, input.normalizedUrl, input.abortSignal);
  const outputTemplate = path.join(input.tempDir, "youtube_video.%(ext)s");
  await wrapper.execPromise([
    "--format",
    formatSelector(input.request),
    "--merge-output-format",
    "mp4",
    "--output",
    outputTemplate,
    "--socket-timeout",
    String(timeoutSeconds(input.request, metadata)),
    "--retries",
    "10",
    "--fragment-retries",
    "50",
    "--file-access-retries",
    "5",
    "--continue",
    "--concurrent-fragments",
    "4",
    ...subtitleArgs(input.request),
    ...youtubeArgs(input.normalizedUrl),
  ], { maxBuffer: 10 * 1024 * 1024 }, input.abortSignal);
  return {
    metadata,
    output: await collectYtDlpOutputFiles(input.tempDir),
  };
};

const buildYoutubeDownloadResult = (input: {
  request: ParsedYoutubeInput;
  metadata: YoutubeMetadata;
  output: Awaited<ReturnType<typeof collectYtDlpOutputFiles>>;
}): YoutubeDownloadResult => {
  if (!input.output.video) {
    return { ok: false, reason: "yt-dlp completed without a supported video file.", reviewRequired: false };
  }
  if (input.output.video.byteSize > input.request.maxBytes) {
    return {
      ok: false,
      reason: `Downloaded YouTube file exceeded maxBytes ${input.request.maxBytes}.`,
      reviewRequired: false,
    };
  }
  return {
    ok: true,
    bytes: input.output.video.bytes,
    contentType: input.output.video.contentType,
    byteSize: input.output.video.byteSize,
    durationMs: input.metadata.durationMs,
    width: input.metadata.width,
    height: input.metadata.height,
    videoId: input.metadata.id ?? extractYoutubeVideoId(input.request.sourcePageUrl),
    subtitles: input.output.subtitles,
  };
};

export const downloadYoutubeVideoWithYtDlp = async (
  input: ParsedYoutubeInput,
  abortSignal: AbortSignal,
): Promise<YoutubeDownloadResult> => {
  const normalizedUrl = normalizeYoutubeVideoUrl(input.sourcePageUrl);
  if (!normalizedUrl) {
    return { ok: false, reason: "Source page URL is not a supported YouTube video URL.", reviewRequired: false };
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "grasseye-youtube-"));
  try {
    const downloaded = await runYoutubeDownload({
      request: input,
      abortSignal,
      tempDir,
      normalizedUrl,
    });
    return buildYoutubeDownloadResult({
      request: input,
      metadata: downloaded.metadata,
      output: downloaded.output,
    });
  } catch (error) {
    return classifyFailure(error);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};
