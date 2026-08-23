import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";

import {
  buildMediaProcessingArtifact,
  ensureMediaProcessingRunDir,
} from "./artifact-storage.js";
import type {
  MediaProcessingArtifact,
  ParsedMediaProcessingAbilityInput,
} from "../schema.js";
import { probeVideoOutputMetadata } from "./ffprobe-metadata.js";

const runCommand = async (input: {
  command: string;
  args: readonly string[];
  timeoutMs: number;
}): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(input.command, [...input.args], { stdio: "ignore" });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ffmpeg_timeout"));
    }, input.timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg_exit_${code ?? "signal"}`));
    });
  });

const videoScaleFilter = (request: ParsedMediaProcessingAbilityInput): string => {
  const width = request.maxWidth ? `min(${request.maxWidth},iw)` : "iw";
  const height = request.maxHeight ? `min(${request.maxHeight},ih)` : "ih";
  return `scale='${width}':'${height}':force_original_aspect_ratio=decrease:force_divisible_by=2`;
};

const targetVideoBitrateKbps = (request: ParsedMediaProcessingAbilityInput, durationMs: number): number | null => {
  if (request.targetBitrateKbps) return request.targetBitrateKbps;
  if (!request.targetMaxBytes || durationMs <= 0) return null;
  const durationSeconds = durationMs / 1000;
  const audioBudgetKbps = 128;
  return Math.max(64, Math.floor((request.targetMaxBytes * 8) / durationSeconds / 1000) - audioBudgetKbps);
};

const videoContentType = "video/mp4";

const loadSharp = async () => (await import("sharp")).default;

const videoRateArgs = (bitrateKbps: number | null, crf: string): string[] =>
  bitrateKbps
    ? ["-b:v", `${bitrateKbps}k`, "-maxrate", `${bitrateKbps}k`, "-bufsize", `${bitrateKbps * 2}k`]
    : ["-crf", crf];

const runVideoTranscodeAttempt = async (input: {
  ffmpegPath: string;
  sourceFilePath: string;
  outputPath: string;
  scale: string;
  timeoutMs: number;
  crf: string;
  bitrateKbps: number | null;
}): Promise<void> => runCommand({
    command: input.ffmpegPath,
    timeoutMs: input.timeoutMs,
    args: [
      "-y",
      "-i",
      input.sourceFilePath,
      "-vf",
      input.scale,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      ...videoRateArgs(input.bitrateKbps, input.crf),
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      input.outputPath,
    ],
  });

const assertVideoOutputPolicy = (input: {
  request: ParsedMediaProcessingAbilityInput;
  metadata: Awaited<ReturnType<typeof probeVideoOutputMetadata>>;
  outputSize: number;
}): void => {
  if (input.request.maxWidth && input.metadata.width > input.request.maxWidth) {
    throw new Error("video_output_width_exceeds_requested_max");
  }
  if (input.request.maxHeight && input.metadata.height > input.request.maxHeight) {
    throw new Error("video_output_height_exceeds_requested_max");
  }
  if (input.request.targetMaxBytes && input.outputSize > input.request.targetMaxBytes) {
    throw new Error("video_output_exceeds_target_max_bytes");
  }
};

export const runFfmpegVideoForWeb = async (input: {
  ffmpegPath: string;
  ffprobePath: string;
  dataDir: string;
  request: ParsedMediaProcessingAbilityInput;
  sourceFilePath: string;
  sourceByteSize: number | null;
  mode: "optimized" | "compressed";
}): Promise<MediaProcessingArtifact[]> => {
  const runDir = await ensureMediaProcessingRunDir(input.dataDir, input.request);
  const outputPath = path.join(runDir, `${input.mode}.mp4`);
  const scale = videoScaleFilter(input.request);
  const sourceMetadata = input.mode === "compressed"
    ? await probeVideoOutputMetadata({
        ffprobePath: input.ffprobePath,
        filePath: input.sourceFilePath,
        timeoutMs: input.request.timeoutMs,
      })
    : null;
  let bitrateKbps = sourceMetadata ? targetVideoBitrateKbps(input.request, sourceMetadata.durationMs) : null;
  const attempts = input.mode === "compressed" ? ["28", "32", "36"] : ["23"];
  let metadata: Awaited<ReturnType<typeof probeVideoOutputMetadata>> | null = null;
  let outputSize = 0;
  for (const crf of attempts) {
    await runVideoTranscodeAttempt({
      ffmpegPath: input.ffmpegPath,
      sourceFilePath: input.sourceFilePath,
      outputPath,
      scale,
      timeoutMs: input.request.timeoutMs,
      crf,
      bitrateKbps,
    });
    metadata = await probeVideoOutputMetadata({
      ffprobePath: input.ffprobePath,
      filePath: outputPath,
      timeoutMs: input.request.timeoutMs,
    });
    outputSize = (await stat(outputPath)).size;
    if (!input.request.targetMaxBytes || outputSize <= input.request.targetMaxBytes) {
      break;
    }
    if (bitrateKbps) {
      bitrateKbps = Math.max(64, Math.floor(bitrateKbps * 0.75));
    }
  }
  if (!metadata) {
    throw new Error("ffprobe_missing_required_video_metadata");
  }
  assertVideoOutputPolicy({ request: input.request, metadata, outputSize });
  const outputMetadata = metadata;
  return [await buildMediaProcessingArtifact({
    input: input.request,
    filePath: outputPath,
    contentType: videoContentType,
    width: outputMetadata.width,
    height: outputMetadata.height,
    durationMs: outputMetadata.durationMs,
    format: outputMetadata.format,
    videoCodec: outputMetadata.videoCodec,
    audioCodec: outputMetadata.audioCodec,
    fastStart: outputMetadata.fastStart,
    targetMaxBytes: input.mode === "compressed" ? input.request.targetMaxBytes ?? null : null,
    targetBitrateKbps: input.mode === "compressed" ? bitrateKbps : null,
    sourceByteSize: input.sourceByteSize,
    derivativeKind: input.mode === "compressed" ? "video_compressed" : "video_optimized",
  })];
};

const posterContentType = (format: string): string => {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  return "image/webp";
};

export const runFfmpegPosterForWeb = async (input: {
  ffmpegPath: string;
  dataDir: string;
  request: ParsedMediaProcessingAbilityInput;
  sourceFilePath: string;
  sourceByteSize: number | null;
}): Promise<MediaProcessingArtifact[]> => {
  const runDir = await ensureMediaProcessingRunDir(input.dataDir, input.request);
  const outputPath = path.join(runDir, `poster.${input.request.outputFormat}`);
  const scale = videoScaleFilter(input.request);
  const writePosterAt = (timestampSeconds: number): Promise<void> =>
    runCommand({
      command: input.ffmpegPath,
      timeoutMs: input.request.timeoutMs,
      args: [
        "-y",
        "-ss",
        String(timestampSeconds),
        "-i",
        input.sourceFilePath,
        "-frames:v",
        "1",
        "-vf",
        scale,
        outputPath,
      ],
    });
  await writePosterAt(input.request.posterTimestampSeconds);
  try {
    await stat(outputPath);
  } catch {
    await writePosterAt(0);
  }
  const sharp = await loadSharp();
  const metadata = await sharp(outputPath).metadata();
  if (input.request.maxWidth && metadata.width && metadata.width > input.request.maxWidth) {
    throw new Error("poster_output_width_exceeds_requested_max");
  }
  if (input.request.maxHeight && metadata.height && metadata.height > input.request.maxHeight) {
    throw new Error("poster_output_height_exceeds_requested_max");
  }
  return [await buildMediaProcessingArtifact({
    input: input.request,
    filePath: outputPath,
    contentType: posterContentType(input.request.outputFormat),
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    durationMs: null,
    format: input.request.outputFormat,
    sourceByteSize: input.sourceByteSize,
    derivativeKind: "poster",
  })];
};
