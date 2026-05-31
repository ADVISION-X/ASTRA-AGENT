import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import YTDlpWrapModule from "yt-dlp-wrap/dist/index.js";

import type { ParsedVideoDownloadAbilityInput } from "../schema.js";
import { extractYoutubeVideoId, normalizeYoutubeVideoUrl } from "./youtube-url.js";
import { resolveYtDlpBinaryPath } from "./youtube-dlp-binary.js";
import { formatSelector, subtitleArgs, youtubeArgs } from "./youtube-dlp-args.js";
import { collectYtDlpOutputFiles, type YoutubeSubtitleDownload } from "./youtube-dlp-output.js";
import {
  classifyYoutubeDlpFailure,
  sanitizeYoutubeProgressLine,
  YOUTUBE_PROCESS_KILL_GRACE_MS,
  YOUTUBE_PROGRESS_INTERVAL_MS,
  youtubeMetadataTimeoutSeconds,
  youtubeTimeoutSeconds,
  type YoutubeDlpFailure,
} from "./youtube-dlp-policy.js";

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

type YoutubeDownloadSuccess = {
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

type YoutubeDownloadFailure = {
  ok: false;
  failureReason: YoutubeDlpFailure["failureReason"];
  reason: string;
  reviewRequired: boolean;
};

type YoutubeDownloadResult = YoutubeDownloadSuccess | YoutubeDownloadFailure;

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

type ParsedYoutubeInput = Extract<
  ParsedVideoDownloadAbilityInput,
  { childCapabilityId: "download-youtube-video-once" }
>;

const readMetadata = async (
  wrapper: YTDlpWrapInstance,
  url: string,
  timeoutMs: number,
  abortSignal: AbortSignal,
): Promise<YoutubeMetadata> => {
  const stdout = await wrapper.execPromise([
    "--dump-json",
    "--no-warnings",
    "--socket-timeout",
    String(youtubeMetadataTimeoutSeconds({ timeoutMs })),
    ...youtubeArgs(url),
  ], { maxBuffer: 10 * 1024 * 1024 }, abortSignal);
  return metadataFromJson(JSON.parse(stdout) as unknown);
};

const runYtDlpProcess = async (input: {
  args: string[];
  abortSignal: AbortSignal;
  onProgress?: (message: string) => void;
}): Promise<void> => {
  const binaryPath = await resolveYtDlpBinaryPath();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(binaryPath, input.args, { stdio: ["ignore", "pipe", "pipe"] });
    const stderr: string[] = [];
    let lastProgressAt = 0;
    const emitProgress = (chunk: Buffer) => {
      const text = chunk.toString();
      stderr.push(text);
      const now = Date.now();
      if (now - lastProgressAt < YOUTUBE_PROGRESS_INTERVAL_MS) return;
      const line = sanitizeYoutubeProgressLine(text);
      if (!line) return;
      lastProgressAt = now;
      input.onProgress?.(line);
    };
    const abort = () => {
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, YOUTUBE_PROCESS_KILL_GRACE_MS).unref();
    };
    if (input.abortSignal.aborted) abort();
    input.abortSignal.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", emitProgress);
    child.stderr.on("data", emitProgress);
    child.on("error", reject);
    child.on("close", (code, signal) => {
      input.abortSignal.removeEventListener("abort", abort);
      if (code === 0) {
        resolve();
        return;
      }
      const tail = stderr.join("").slice(-2_000).trim();
      reject(new Error(input.abortSignal.aborted
        ? "yt-dlp aborted after request timeout."
        : `yt-dlp failed with code ${code ?? "null"} signal ${signal ?? "none"}: ${tail || "no stderr"}`));
    });
  });
};

const runYoutubeDownload = async (input: {
  request: ParsedYoutubeInput;
  abortSignal: AbortSignal;
  tempDir: string;
  normalizedUrl: string;
  onProgress?: (message: string) => void;
}): Promise<{
  metadata: YoutubeMetadata;
  output: Awaited<ReturnType<typeof collectYtDlpOutputFiles>>;
}> => {
  const wrapper = new YTDlpWrapRuntime(await resolveYtDlpBinaryPath());
  input.onProgress?.("youtube metadata probe started");
  const metadata = await readMetadata(
    wrapper,
    input.normalizedUrl,
    input.request.timeoutMs,
    input.abortSignal,
  );
  input.onProgress?.("youtube metadata resolved: " + (
    metadata.durationMs ? Math.round(metadata.durationMs / 1000) + "s" : "duration_unknown"
  ));
  const outputTemplate = path.join(input.tempDir, "youtube_video.%(ext)s");
  await runYtDlpProcess({
    abortSignal: input.abortSignal,
    ...(input.onProgress ? { onProgress: input.onProgress } : {}),
    args: [
    "--format",
    formatSelector(input.request),
    "--merge-output-format",
    "mp4",
    "--output",
    outputTemplate,
    "--socket-timeout",
    String(youtubeTimeoutSeconds(input.request)),
    "--retries",
    "2",
    "--fragment-retries",
    "5",
    "--file-access-retries",
    "2",
    "--newline",
    "--no-playlist",
    "--continue",
    "--concurrent-fragments",
    "4",
    ...subtitleArgs(input.request),
    ...youtubeArgs(input.normalizedUrl),
    ],
  });
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
    return {
      ok: false,
      failureReason: "downloaded_file_invalid",
      reason: "yt-dlp completed without a supported video file.",
      reviewRequired: false,
    };
  }
  if (input.output.video.byteSize > input.request.maxBytes) {
    return {
      ok: false,
      failureReason: "download_too_large",
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
  onProgress?: (message: string) => void,
): Promise<YoutubeDownloadResult> => {
  const normalizedUrl = normalizeYoutubeVideoUrl(input.sourcePageUrl);
  if (!normalizedUrl) {
    return {
      ok: false,
      failureReason: "source_page_mismatch",
      reason: "Source page URL is not a supported YouTube video URL.",
      reviewRequired: false,
    };
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "grasseye-youtube-"));
  try {
    const downloaded = await runYoutubeDownload({
      request: input,
      abortSignal,
      tempDir,
      normalizedUrl,
      ...(onProgress ? { onProgress } : {}),
    });
    return buildYoutubeDownloadResult({
      request: input,
      metadata: downloaded.metadata,
      output: downloaded.output,
    });
  } catch (error) {
    return { ok: false, ...classifyYoutubeDlpFailure(error) };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};
