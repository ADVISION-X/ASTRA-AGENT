import { access } from "node:fs/promises";
import { constants, existsSync } from "node:fs";
import { execFile, spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

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

export type MediaProcessingLatestDependencyPackage = {
  name: typeof MEDIA_PROCESSING_LATEST_DEPENDENCY_PACKAGES[number];
  current: string | null;
  wanted: string | null;
  latest: string | null;
};

export type MediaProcessingLatestDependencyRefresh = {
  status: "already_latest" | "updated" | "failed";
  packages: MediaProcessingLatestDependencyPackage[];
  command: "npm outdated" | "npm install";
  reason: string | null;
  startedAt: string;
  completedAt: string;
};

type NpmOutdatedPackage = {
  current?: unknown;
  wanted?: unknown;
  latest?: unknown;
};

type ExecFailure = {
  code?: unknown;
  stdout?: unknown;
  stderr?: unknown;
  message?: unknown;
};

const execFileAsync = promisify(execFile);
const npmLatestTag = "@latest";

export const MEDIA_PROCESSING_LATEST_DEPENDENCY_PACKAGES = [
  "sharp",
  "@img/sharp-darwin-arm64",
  "ffmpeg-static",
  "ffprobe-static",
] as const;

let activeLatestDependencyRefresh: Promise<MediaProcessingLatestDependencyRefresh> | null = null;

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

const findPackageRoot = (): string => {
  let current = process.cwd();
  while (true) {
    if (existsSync(path.join(current, "package.json"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
};

const packageSnapshot = (
  outdated: Record<string, NpmOutdatedPackage>,
): MediaProcessingLatestDependencyPackage[] =>
  MEDIA_PROCESSING_LATEST_DEPENDENCY_PACKAGES.map((name) => {
    const entry = outdated[name];
    return {
      name,
      current: typeof entry?.current === "string" ? entry.current : null,
      wanted: typeof entry?.wanted === "string" ? entry.wanted : null,
      latest: typeof entry?.latest === "string" ? entry.latest : null,
    };
  });

const parseNpmOutdated = (stdout: string): Record<string, NpmOutdatedPackage> => {
  if (stdout.trim() === "") return {};
  const parsed = JSON.parse(stdout) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as Record<string, NpmOutdatedPackage>;
};

const runNpm = async (input: {
  cwd: string;
  args: readonly string[];
  timeoutMs: number;
}): Promise<{ stdout: string }> => {
  try {
    const { stdout } = await execFileAsync("npm", [...input.args], {
      cwd: input.cwd,
      timeout: input.timeoutMs,
      maxBuffer: 1024 * 1024,
    });
    return { stdout: String(stdout) };
  } catch (error) {
    const failure = error as ExecFailure;
    if (failure.code === 1 && typeof failure.stdout === "string") {
      return { stdout: failure.stdout };
    }
    const reason = typeof failure.message === "string" ? failure.message : "npm_latest_dependency_refresh_failed";
    throw new Error(reason);
  }
};

const refreshMediaProcessingLatestDependencies = async (): Promise<MediaProcessingLatestDependencyRefresh> => {
  const startedAt = new Date().toISOString();
  try {
    const cwd = findPackageRoot();
    const outdatedResult = await runNpm({
      cwd,
      timeoutMs: 120_000,
      args: ["outdated", "--json", ...MEDIA_PROCESSING_LATEST_DEPENDENCY_PACKAGES],
    });
    const outdated = parseNpmOutdated(outdatedResult.stdout);
    const outdatedPackageNames = MEDIA_PROCESSING_LATEST_DEPENDENCY_PACKAGES.filter((name) => Boolean(outdated[name]));
    if (outdatedPackageNames.length === 0) {
      return {
        status: "already_latest",
        packages: packageSnapshot(outdated),
        command: "npm outdated",
        reason: null,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    }
    await runNpm({
      cwd,
      timeoutMs: 300_000,
      args: ["install", ...outdatedPackageNames.map((name) => `${name}${npmLatestTag}`)],
    });
    return {
      status: "updated",
      packages: packageSnapshot(outdated),
      command: "npm install",
      reason: null,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "failed",
      packages: packageSnapshot({}),
      command: "npm outdated",
      reason: error instanceof Error ? error.message : "npm_latest_dependency_refresh_failed",
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }
};

export const ensureMediaProcessingLatestDependenciesForUse = async (): Promise<MediaProcessingLatestDependencyRefresh> => {
  if (activeLatestDependencyRefresh) return activeLatestDependencyRefresh;
  activeLatestDependencyRefresh = refreshMediaProcessingLatestDependencies()
    .finally(() => {
      activeLatestDependencyRefresh = null;
    });
  return activeLatestDependencyRefresh;
};

const resolveFfprobeStaticPath = (): string | null => {
  return typeof ffprobeStatic.path === "string" ? ffprobeStatic.path : null;
};

const resolveFfmpegStaticPath = (): string | null => {
  return typeof ffmpegStaticPath === "string" ? ffmpegStaticPath : null;
};

export const prepareMediaProcessingRuntimeDependencies = async (): Promise<MediaProcessingRuntimeReadiness> => {
  const imageAvailable = await import("sharp")
    .then(() => true)
    .catch(() => false);
  const envFfmpegPath = process.env.GRASSEYE_FFMPEG_PATH ?? null;
  const ffmpegStaticPath = resolveFfmpegStaticPath();
  const ffmpegStaticReady = ffmpegStaticPath !== null && await executableFile(ffmpegStaticPath);
  const envFfmpegReady = envFfmpegPath !== null && await executableFile(envFfmpegPath);
  const ffmpegPath = envFfmpegReady
    ? envFfmpegPath
    : ffmpegStaticReady
      ? ffmpegStaticPath
      : await commandRuns("ffmpeg", ["-version"])
        ? "ffmpeg"
        : null;
  const ffprobeStaticPath = resolveFfprobeStaticPath();
  const ffprobePath = ffprobeStaticPath && await executableFile(ffprobeStaticPath)
    ? ffprobeStaticPath
    : await commandRuns("ffprobe", ["-version"])
      ? "ffprobe"
      : null;
  const videoAvailable = ffmpegPath !== null && ffprobePath !== null;
  const videoReason = videoAvailable
    ? null
    : ffmpegPath === null
      ? "ffmpeg_runtime_unavailable"
      : "ffprobe_runtime_unavailable";
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
      reason: videoReason,
    },
  };
};
