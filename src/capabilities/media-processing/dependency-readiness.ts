import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";

import ffmpegStaticPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

export type MediaProcessingRuntimeReadiness = {
  image: {
    available: boolean;
    engine: "sharp";
    reason: string | null;
  };
  video: {
    available: boolean;
    engine: "ffmpeg";
    ffmpegPath: string | null;
    ffprobePath: string | null;
    reason: string | null;
  };
};

export const MEDIA_PROCESSING_LOCKED_DEPENDENCY_PACKAGES = [
  "sharp",
  "@img/sharp-darwin-arm64",
  "ffmpeg-static",
  "ffprobe-static",
] as const;

export interface MediaProcessingLockedDependencyReadiness {
  readonly status: "ready" | "failed";
  readonly packages: typeof MEDIA_PROCESSING_LOCKED_DEPENDENCY_PACKAGES;
  readonly reason: string | null;
  readonly checkedAt: string;
}

const commandRuns = async (command: string, args: readonly string[]): Promise<boolean> =>
  new Promise((resolve) => {
    const child = spawn(command, [...args], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });

const executableFile = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const resolveFfprobeStaticPath = (): string | null =>
  typeof ffprobeStatic.path === "string" ? ffprobeStatic.path : null;

const resolveFfmpegStaticPath = (): string | null =>
  typeof ffmpegStaticPath === "string" ? ffmpegStaticPath : null;

export const prepareMediaProcessingRuntimeDependencies = async (): Promise<MediaProcessingRuntimeReadiness> => {
  const imageAvailable = await import("sharp").then(() => true).catch(() => false);
  const envFfmpegPath = process.env.GRASSEYE_FFMPEG_PATH ?? null;
  const packagedFfmpegPath = resolveFfmpegStaticPath();
  const packagedFfmpegReady = packagedFfmpegPath !== null && await executableFile(packagedFfmpegPath);
  const envFfmpegReady = envFfmpegPath !== null && await executableFile(envFfmpegPath);
  const ffmpegPath = envFfmpegReady
    ? envFfmpegPath
    : packagedFfmpegReady
      ? packagedFfmpegPath
      : await commandRuns("ffmpeg", ["-version"])
        ? "ffmpeg"
        : null;
  const packagedFfprobePath = resolveFfprobeStaticPath();
  const ffprobePath = packagedFfprobePath && await executableFile(packagedFfprobePath)
    ? packagedFfprobePath
    : await commandRuns("ffprobe", ["-version"])
      ? "ffprobe"
      : null;
  const videoAvailable = ffmpegPath !== null && ffprobePath !== null;
  return {
    image: {
      available: imageAvailable,
      engine: "sharp",
      reason: imageAvailable ? null : "sharp_runtime_unavailable",
    },
    video: {
      available: videoAvailable,
      engine: "ffmpeg",
      ffmpegPath,
      ffprobePath,
      reason: videoAvailable
        ? null
        : ffmpegPath === null
          ? "ffmpeg_runtime_unavailable"
          : "ffprobe_runtime_unavailable",
    },
  };
};

export const ensureMediaProcessingLockedDependenciesForUse = async (): Promise<MediaProcessingLockedDependencyReadiness> => {
  const readiness = await prepareMediaProcessingRuntimeDependencies();
  const ready = readiness.image.available && readiness.video.available;
  return {
    status: ready ? "ready" : "failed",
    packages: MEDIA_PROCESSING_LOCKED_DEPENDENCY_PACKAGES,
    reason: ready
      ? null
      : [readiness.image.reason, readiness.video.reason].filter(Boolean).join(","),
    checkedAt: new Date().toISOString(),
  };
};
