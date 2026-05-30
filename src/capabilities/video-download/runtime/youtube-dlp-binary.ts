import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import YTDlpWrapModule from "yt-dlp-wrap/dist/index.js";

type YTDlpWrapRuntime = {
  downloadFromGithub(binaryPath: string): Promise<void>;
};

const unwrapDefaultExport = (value: unknown): unknown => {
  const record = value && typeof value === "object" ? value as { default?: unknown } : null;
  return record?.default ?? value;
};

const resolveYTDlpWrapRuntime = (value: unknown): YTDlpWrapRuntime => {
  const runtimeValue = unwrapDefaultExport(value);
  if (!runtimeValue || typeof runtimeValue !== "function") {
    throw new Error("yt-dlp-wrap runtime is not constructable.");
  }
  const runtime = runtimeValue as Partial<YTDlpWrapRuntime>;
  if (typeof runtime.downloadFromGithub !== "function") {
    throw new Error("yt-dlp-wrap runtime is missing downloadFromGithub.");
  }
  return runtime as YTDlpWrapRuntime;
};

const YTDlpWrapRuntime = resolveYTDlpWrapRuntime(YTDlpWrapModule);

const execFileAsync = promisify(execFile);

const localBinaryPath = (): string =>
  path.join(homedir(), ".cache", "grasseye", "video-download", "yt-dlp");

const localRunnerPath = (): string =>
  path.join(homedir(), ".cache", "grasseye", "video-download", "yt-dlp-runner");

const canExecute = async (binaryPath: string): Promise<boolean> => {
  try {
    await execFileAsync(binaryPath, ["--version"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const resolvePythonRuntime = async (): Promise<string | null> => {
  for (const candidate of ["python3.12", "python3.11", "python3.10", "python3"]) {
    try {
      const { stdout } = await execFileAsync(candidate, ["-c", "import sys; print(f'{sys.version_info[0]}.{sys.version_info[1]}')"], { timeout: 5_000 });
      const [majorRaw, minorRaw] = stdout.trim().split(".");
      const major = Number(majorRaw);
      const minor = Number(minorRaw);
      if (major > 3 || major === 3 && minor >= 10) {
        return candidate;
      }
    } catch {
      // Keep looking for a Python runtime supported by current yt-dlp.
    }
  }
  return null;
};

const buildLocalRunner = async (binaryPath: string): Promise<string | null> => {
  const python = await resolvePythonRuntime();
  if (!python) return null;
  const runner = localRunnerPath();
  await mkdir(path.dirname(runner), { recursive: true });
  await writeFile(runner, `#!/bin/sh\nexec ${python} ${JSON.stringify(binaryPath)} "$@"\n`);
  await chmod(runner, 0o755);
  return await canExecute(runner) ? runner : null;
};

const downloadLatestBinary = async (binaryPath: string): Promise<string> => {
  await mkdir(path.dirname(binaryPath), { recursive: true });
  await YTDlpWrapRuntime.downloadFromGithub(binaryPath);
  await chmod(binaryPath, 0o755);
  return binaryPath;
};

export const resolveYtDlpBinaryPath = async (): Promise<string> => {
  const configured = process.env.GRASSEYE_YT_DLP_BINARY;
  if (configured && await canExecute(configured)) return configured;
  if (await canExecute("yt-dlp")) return "yt-dlp";

  const local = localBinaryPath();
  const shouldRefresh = process.env.GRASSEYE_YT_DLP_AUTO_UPDATE !== "0";
  if (!shouldRefresh && await fileExists(local) && await canExecute(local)) {
    return local;
  }
  if (!shouldRefresh && await fileExists(local)) {
    const runner = await buildLocalRunner(local);
    if (runner) return runner;
  }
  const downloaded = await downloadLatestBinary(local);
  return await buildLocalRunner(downloaded) ?? downloaded;
};
