import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

import {
  GOVERNED_APP_NAME,
  GOVERNED_BUNDLE_ID,
  MACOS_OPEN_BIN,
  MACOS_PGREP_BIN,
} from "./open-local-program-adapter-constants.js";

export type MacOSCommandResult = {
  exitCode: number | null;
  stderr: string;
};

export const waitForLocalProgram = (ms: number, abortSignal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new Error("LOCAL_PROGRAM_LAUNCH_FAILED: open local program aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    abortSignal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("LOCAL_PROGRAM_LAUNCH_FAILED: open local program aborted"));
    }, { once: true });
  });

export const runFixedMacOSCommand = (bin: string, args: readonly string[], abortSignal?: AbortSignal): Promise<MacOSCommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(bin, [...args], { shell: false, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ exitCode, stderr }));
    abortSignal?.addEventListener("abort", () => {
      child.kill("SIGTERM");
      reject(new Error("LOCAL_PROGRAM_LAUNCH_FAILED: open local program aborted"));
    }, { once: true });
  });

export const isGovernedAppInstalled = () => {
  if (process.platform !== "darwin" || !existsSync(MACOS_OPEN_BIN)) return false;
  const probe = spawnSync(MACOS_OPEN_BIN, ["-Ra", GOVERNED_APP_NAME], { shell: false, stdio: ["ignore", "ignore", "ignore"] });
  return probe.status === 0;
};

export const isGovernedAppRunning = async () => {
  if (process.platform !== "darwin" || !existsSync(MACOS_PGREP_BIN)) return false;
  const byBundle = await runFixedMacOSCommand(MACOS_PGREP_BIN, ["-f", GOVERNED_BUNDLE_ID]);
  if (byBundle.exitCode === 0) return true;
  const byName = await runFixedMacOSCommand(MACOS_PGREP_BIN, ["-f", GOVERNED_APP_NAME]);
  return byName.exitCode === 0;
};
