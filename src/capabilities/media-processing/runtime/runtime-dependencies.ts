import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

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

const require = createRequire(import.meta.url);

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

const resolveFfprobeStaticPath = (): string | null => {
  try {
    const loaded = require("ffprobe-static") as { path?: unknown };
    return typeof loaded.path === "string" ? loaded.path : null;
  } catch {
    return null;
  }
};

export const prepareMediaProcessingRuntimeDependencies = async (): Promise<MediaProcessingRuntimeReadiness> => {
  const imageAvailable = await import("sharp")
    .then(() => true)
    .catch(() => false);
  const envFfmpegPath = process.env.GRASSEYE_FFMPEG_PATH;
  const ffmpegPath = envFfmpegPath && await executableFile(envFfmpegPath)
    ? envFfmpegPath
    : await commandRuns("ffmpeg", ["-version"])
      ? "ffmpeg"
      : null;
  const ffprobeStaticPath = resolveFfprobeStaticPath();
  const ffprobePath = ffprobeStaticPath && await executableFile(ffprobeStaticPath)
    ? ffprobeStaticPath
    : await commandRuns("ffprobe", ["-version"])
      ? "ffprobe"
      : null;
  return {
    image: {
      available: imageAvailable,
      engine: "sharp",
      reason: imageAvailable ? null : "sharp_runtime_unavailable",
    },
    video: {
      available: ffmpegPath !== null,
      engine: "ffmpeg",
      ffmpegPath,
      ffprobePath,
      reason: ffmpegPath ? null : "ffmpeg_runtime_unavailable",
    },
  };
};
