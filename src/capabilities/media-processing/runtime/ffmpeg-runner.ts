import { spawn } from "node:child_process";
import path from "node:path";

import {
  buildMediaProcessingArtifact,
  ensureMediaProcessingRunDir,
} from "./artifact-storage.js";
import type {
  MediaProcessingArtifact,
  ParsedMediaProcessingAbilityInput,
} from "../schema.js";

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

export const runFfmpegVideoForWeb = async (input: {
  ffmpegPath: string;
  dataDir: string;
  request: ParsedMediaProcessingAbilityInput;
  sourceFilePath: string;
  mode: "optimized" | "compressed";
}): Promise<MediaProcessingArtifact[]> => {
  const runDir = await ensureMediaProcessingRunDir(input.dataDir, input.request);
  const outputPath = path.join(runDir, `${input.mode}.mp4`);
  const scale = input.request.maxWidth
    ? `scale='min(${input.request.maxWidth},iw)':-2`
    : "scale=iw:ih";
  const crf = input.mode === "compressed" ? "28" : "23";
  await runCommand({
    command: input.ffmpegPath,
    timeoutMs: input.request.timeoutMs,
    args: [
      "-y",
      "-i",
      input.sourceFilePath,
      "-vf",
      scale,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      crf,
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ],
  });
  return [await buildMediaProcessingArtifact({
    input: input.request,
    filePath: outputPath,
    contentType: "video/mp4",
    width: null,
    height: null,
    durationMs: null,
    format: "mp4",
    derivativeKind: input.mode === "compressed" ? "video_compressed" : "video_optimized",
  })];
};

export const runFfmpegPosterForWeb = async (input: {
  ffmpegPath: string;
  dataDir: string;
  request: ParsedMediaProcessingAbilityInput;
  sourceFilePath: string;
}): Promise<MediaProcessingArtifact[]> => {
  const runDir = await ensureMediaProcessingRunDir(input.dataDir, input.request);
  const outputPath = path.join(runDir, `poster.${input.request.outputFormat}`);
  await runCommand({
    command: input.ffmpegPath,
    timeoutMs: input.request.timeoutMs,
    args: [
      "-y",
      "-ss",
      String(input.request.posterTimestampSeconds),
      "-i",
      input.sourceFilePath,
      "-frames:v",
      "1",
      outputPath,
    ],
  });
  return [await buildMediaProcessingArtifact({
    input: input.request,
    filePath: outputPath,
    contentType: input.request.outputFormat === "jpeg" ? "image/jpeg" : "image/webp",
    width: null,
    height: null,
    durationMs: null,
    format: input.request.outputFormat,
    derivativeKind: "poster",
  })];
};
