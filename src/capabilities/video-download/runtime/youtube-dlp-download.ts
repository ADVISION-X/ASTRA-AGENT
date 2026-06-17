import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import type { ParsedVideoDownloadAbilityInput } from "../schema.js";
import { extractYoutubeVideoId, normalizeYoutubeVideoUrl } from "./youtube-url.js";
import { getPreparedYtDlpBinaryPath } from "./youtube-dlp-binary.js";
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

type YoutubeMetadata = {
  id: string | null;
  title: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  subtitleLanguages: string[];
};

type ParsedYoutubeInput = Extract<
  ParsedVideoDownloadAbilityInput,
  { childCapabilityId: "download-youtube-video-once" }
>;

type YoutubeDownloadSuccess = {
  ok: true;
  filePath: string;
  tempDir: string;
  contentType: string;
  byteSize: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  selectedQuality: ParsedYoutubeInput["preferredQuality"] | "unknown";
  videoId: string | null;
  sourceTitle: string;
  displayTitle: string;
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
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

export const youtubeDisplayTitle = (sourceTitle: string): string => {
  const cleaned = [...sourceTitle.trim()]
    .map((char) => {
      if (char === "/" || char === "\\" || char === ":" || char === "*" || char === "?" || char === "\"" || char === "<" || char === ">" || char === "|") {
        return " ";
      }
      const code = char.charCodeAt(0);
      return code < 32 ? " " : char;
    })
    .join("")
    .split(" ")
    .filter((part) => part.length > 0)
    .join(" ")
    .slice(0, 120)
    .trim();
  return cleaned || "YouTube video";
};

const metadataFromJson = (raw: unknown): YoutubeMetadata => {
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const seconds = numberField(record.duration);
  const subtitles = typeof record.subtitles === "object" && record.subtitles !== null
    ? Object.keys(record.subtitles)
    : [];
  const automaticCaptions = typeof record.automatic_captions === "object" && record.automatic_captions !== null
    ? Object.keys(record.automatic_captions)
    : [];
  return {
    id: stringField(record.id),
    title: stringField(record.title),
    durationMs: seconds === null ? null : Math.round(seconds * 1000),
    width: numberField(record.width),
    height: numberField(record.height),
    fileSize: numberField(record.filesize) ?? numberField(record.filesize_approx),
    subtitleLanguages: [...new Set([...subtitles, ...automaticCaptions])],
  };
};

const runYtDlpProcess = async (input: {
  args: string[];
  abortSignal: AbortSignal;
  captureStdout?: boolean;
  onProgress?: (message: string) => void;
  processTimeoutMs?: number;
}): Promise<string> => {
  const binaryPath = getPreparedYtDlpBinaryPath();
  return new Promise<string>((resolve, reject) => {
    const child = spawn(binaryPath, input.args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: string[] = [];
    const stderr: string[] = [];
    let settled = false;
    let lastProgressAt = 0;
    let processTimeout: NodeJS.Timeout | null = null;
    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      if (processTimeout) clearTimeout(processTimeout);
      reject(error);
    };
    const abort = () => {
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, YOUTUBE_PROCESS_KILL_GRACE_MS).unref();
    };
    if (input.processTimeoutMs) {
      processTimeout = setTimeout(() => {
        abort();
        rejectOnce(new Error(`yt-dlp process timed out after ${input.processTimeoutMs}ms.`));
      }, input.processTimeoutMs);
      processTimeout.unref();
    }
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
    if (input.abortSignal.aborted) abort();
    input.abortSignal.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk: Buffer) => {
      if (input.captureStdout) stdout.push(chunk.toString());
      else emitProgress(chunk);
    });
    child.stderr.on("data", emitProgress);
    child.on("error", rejectOnce);
    child.on("close", (code, signal) => {
      input.abortSignal.removeEventListener("abort", abort);
      if (processTimeout) clearTimeout(processTimeout);
      if (settled) return;
      settled = true;
      if (code === 0) {
        resolve(stdout.join(""));
        return;
      }
      const tail = stderr.join("").slice(-2_000).trim();
      reject(new Error(input.abortSignal.aborted
        ? "yt-dlp aborted after request timeout."
        : `yt-dlp failed with code ${code ?? "null"} signal ${signal ?? "none"}: ${tail || "no stderr"}`));
    });
  });
};

const readMetadata = async (
  url: string,
  timeoutMs: number,
  abortSignal: AbortSignal,
): Promise<YoutubeMetadata> => {
  const metadataTimeoutMs = youtubeMetadataTimeoutSeconds({ timeoutMs }) * 1000;
  const stdout = await runYtDlpProcess({
    abortSignal,
    captureStdout: true,
    processTimeoutMs: metadataTimeoutMs + YOUTUBE_PROCESS_KILL_GRACE_MS,
    args: [
    "--dump-json",
    "--no-warnings",
    "--socket-timeout",
    String(Math.ceil(metadataTimeoutMs / 1000)),
    ...youtubeArgs(url),
    ],
  });
  return metadataFromJson(JSON.parse(stdout) as unknown);
};

export const youtubeExpectedSubtitleLanguages = (
  availableLanguages: readonly string[],
  requestedLanguages: readonly string[],
  downloadSubtitles: boolean,
): Set<string> => {
  if (!downloadSubtitles) return new Set();
  return new Set(availableLanguages.filter((language) =>
    requestedLanguages.some((requested) => youtubeLanguageMatches(requested, language))));
};

const expectedSubtitleLanguages = (metadata: YoutubeMetadata, request: ParsedYoutubeInput): Set<string> =>
  youtubeExpectedSubtitleLanguages(metadata.subtitleLanguages, request.subtitleLanguages, request.downloadSubtitles);

const missingSubtitleLanguages = (
  expected: Set<string>,
  subtitles: readonly YoutubeSubtitleDownload[],
): string[] => {
  const downloaded = new Set(subtitles.map((subtitle) => subtitle.language));
  return [...expected].filter((language) =>
    ![...downloaded].some((downloadedLanguage) => youtubeLanguageMatches(language, downloadedLanguage)));
};

export const youtubeLanguageMatches = (requestedLanguage: string, availableLanguage: string): boolean => {
  const requested = requestedLanguage.toLowerCase();
  const available = availableLanguage.toLowerCase();
  return available === requested || available.startsWith(`${requested}-`) || requested.startsWith(`${available}-`);
};

const selectedQualityFromHeight = (
  _request: ParsedYoutubeInput,
  height: number,
): ParsedYoutubeInput["preferredQuality"] | "unknown" => {
  const knownHeights = [2160, 1440, 1080, 720, 480, 360] as const;
  const matched = knownHeights.find((candidate) => height >= candidate);
  return matched ? `${matched}p` as ParsedYoutubeInput["preferredQuality"] : "360p";
};

export const maxYoutubeHeightForQuality = (quality: ParsedYoutubeInput["preferredQuality"]): number => {
  if (quality === "hd") return 1080;
  if (quality === "sd") return 480;
  if (quality === "best_available") return 2160;
  return Number(quality.slice(0, -1));
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
  input.onProgress?.("youtube metadata probe started");
  const metadata = await readMetadata(
    input.normalizedUrl,
    input.request.timeoutMs,
    input.abortSignal,
  );
  input.onProgress?.("youtube metadata resolved: " + (
    metadata.durationMs ? Math.round(metadata.durationMs / 1000) + "s" : "duration_unknown"
  ));
  const outputTemplate = path.join(input.tempDir, "%(title).120B-%(id)s.%(ext)s");
  await runYtDlpProcess({
    abortSignal: input.abortSignal,
    ...(input.onProgress ? { onProgress: input.onProgress } : {}),
    processTimeoutMs: input.request.timeoutMs + YOUTUBE_PROCESS_KILL_GRACE_MS,
    args: [
    "--format",
    formatSelector(input.request),
    "--merge-output-format",
    "mp4",
    "--output",
    outputTemplate,
    "--max-filesize",
    String(input.request.maxBytes),
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
  tempDir: string;
}): YoutubeDownloadResult => {
  if (!input.output.video) {
    return {
      ok: false,
      failureReason: "downloaded_file_invalid",
      reason: "yt-dlp completed without a supported video file.",
      reviewRequired: false,
    };
  }
  if (!input.metadata.title) {
    return {
      ok: false,
      failureReason: "metadata_validation_failed",
      reason: "YouTube metadata did not expose a source title.",
      reviewRequired: false,
    };
  }
  const maxHeight = maxYoutubeHeightForQuality(input.request.preferredQuality);
  if (input.output.video.height > maxHeight) {
    return {
      ok: false,
      failureReason: "metadata_validation_failed",
      reason: `YouTube selected media height ${input.output.video.height} exceeds requested quality limit ${maxHeight}.`,
      reviewRequired: false,
    };
  }
  const missingSubtitles = missingSubtitleLanguages(
    expectedSubtitleLanguages(input.metadata, input.request),
    input.output.subtitles,
  );
  if (missingSubtitles.length > 0) {
    return {
      ok: false,
      failureReason: "metadata_validation_failed",
      reason: `YouTube reported subtitles for requested language(s), but subtitle artifacts were not written: ${missingSubtitles.join(", ")}.`,
      reviewRequired: false,
    };
  }
  return {
    ok: true,
    filePath: input.output.video.filePath,
    tempDir: input.tempDir,
    contentType: input.output.video.contentType,
    byteSize: input.output.video.byteSize,
    durationMs: input.output.video.durationMs,
    width: input.output.video.width,
    height: input.output.video.height,
    selectedQuality: selectedQualityFromHeight(input.request, input.output.video.height),
    videoId: input.metadata.id ?? extractYoutubeVideoId(input.request.sourcePageUrl),
    sourceTitle: input.metadata.title,
    displayTitle: youtubeDisplayTitle(input.metadata.title),
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
    const result = buildYoutubeDownloadResult({
      request: input,
      metadata: downloaded.metadata,
      output: downloaded.output,
      tempDir,
    });
    if (!result.ok) {
      await rm(tempDir, { recursive: true, force: true });
    }
    return result;
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    return { ok: false, ...classifyYoutubeDlpFailure(error) };
  }
};
