/**
 * open-local-program-adapter.ts — macOS Open Local Program governed adapter.
 *
 * Assembles the local program port for the Open ability group.
 * Only supports macOS / iPhone Mirroring governed profile.
 */

import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

import type { OpenLocalProgramPort } from "../../capabilities/open/index.js";
import type { OpenLocalProgramLaunchResult } from "../../capabilities/open/ports/open-local-program-port.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const GOVERNED_TARGET_PROFILE_REF = "macos-app:iphone-mirroring";
const GOVERNED_APP_NAME = "iPhone Mirroring";
const GOVERNED_BUNDLE_ID = "com.apple.ScreenContinuity";
const GOVERNED_LAUNCH_METHOD = "macos-open-application";
const MACOS_OPEN_BIN = "/usr/bin/open";
const MACOS_PGREP_BIN = "/usr/bin/pgrep";

// ─── Result helpers ───────────────────────────────────────────────────────────

function failedLocalProgramLaunch(input: {
  message: string;
  createdAt: string;
  appLaunchAttemptRef: string;
}): OpenLocalProgramLaunchResult {
  return {
    localProgramActionId: null,
    ok: false,
    message: input.message,
    createdAt: input.createdAt,
    appLaunchAttemptRef: input.appLaunchAttemptRef,
    windowHandoffRef: null,
    localAppStateHandoffRef: null,
    portKind: "open-local-program-port",
  };
}

// ─── System utilities ─────────────────────────────────────────────────────────

type MacOSCommandResult = { exitCode: number | null; stderr: string };

function waitMs(ms: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
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
}

async function waitForLocalProgramCondition(input: {
  timeoutMs: number;
  abortSignal?: AbortSignal;
  pollIntervalMs?: number;
  isReady: () => Promise<boolean>;
}): Promise<boolean> {
  const deadline = Date.now() + input.timeoutMs;
  const pollIntervalMs = Math.max(50, input.pollIntervalMs ?? 100);
  while (true) {
    if (await input.isReady()) return true;
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return false;
    await waitMs(Math.min(pollIntervalMs, remainingMs), input.abortSignal);
  }
}

function runFixedMacOSCommand(bin: string, args: readonly string[], abortSignal?: AbortSignal): Promise<MacOSCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, [...args], { shell: false, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer | string) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ exitCode, stderr }));
    abortSignal?.addEventListener("abort", () => {
      child.kill("SIGTERM");
      reject(new Error("LOCAL_PROGRAM_LAUNCH_FAILED: open local program aborted"));
    }, { once: true });
  });
}

function isGovernedAppInstalled(): boolean {
  if (process.platform !== "darwin" || !existsSync(MACOS_OPEN_BIN)) return false;
  const probe = spawnSync(MACOS_OPEN_BIN, ["-Ra", GOVERNED_APP_NAME], { shell: false, stdio: ["ignore", "ignore", "ignore"] });
  return probe.status === 0;
}

async function isGovernedAppRunning(): Promise<boolean> {
  if (process.platform !== "darwin" || !existsSync(MACOS_PGREP_BIN)) return false;
  const byBundle = await runFixedMacOSCommand(MACOS_PGREP_BIN, ["-f", GOVERNED_BUNDLE_ID]);
  if (byBundle.exitCode === 0) return true;
  const byName = await runFixedMacOSCommand(MACOS_PGREP_BIN, ["-f", GOVERNED_APP_NAME]);
  return byName.exitCode === 0;
}

// ─── Readiness ────────────────────────────────────────────────────────────────

export function getOpenLocalProgramAdapterReadiness(): { ok: boolean; code: string; detail: string } {
  if (process.platform !== "darwin") {
    return { ok: false, code: "BLOCKED_OPEN_LOCAL_PROGRAM_PORT_NOT_CONFIGURED", detail: "macOS local program launch is available only on darwin runtime." };
  }
  if (!existsSync(MACOS_OPEN_BIN)) {
    return { ok: false, code: "BLOCKED_OPEN_LOCAL_PROGRAM_PORT_NOT_CONFIGURED", detail: "Required governed macOS open binary is unavailable." };
  }
  return { ok: true, code: "OPEN_LOCAL_PROGRAM_PORT_CONFIGURED", detail: "macOS open binary available." };
}

// ─── Adapter factory ──────────────────────────────────────────────────────────

export function createGovernedMacOSOpenLocalProgramAdapter(): OpenLocalProgramPort {
  return {
    async openLocalProgram(input) {
      const now = new Date().toISOString();
      const appLaunchAttemptRef = input.openAttemptRef;

      if (input.platformId !== "macos-local" || input.targetKind !== "local-program" || input.allowedLaunchMethod !== "macos-open-application") {
        return failedLocalProgramLaunch({ message: "Unsupported platform, targetKind, or launchMethod for macOS open adapter.", createdAt: now, appLaunchAttemptRef });
      }

      if (process.platform !== "darwin") {
        return failedLocalProgramLaunch({ message: "macOS launch is only available on darwin.", createdAt: now, appLaunchAttemptRef });
      }

      if (!existsSync(MACOS_OPEN_BIN)) {
        return failedLocalProgramLaunch({ message: "macOS open binary is unavailable.", createdAt: now, appLaunchAttemptRef });
      }

      if (!isGovernedAppInstalled()) {
        return failedLocalProgramLaunch({ message: `${GOVERNED_APP_NAME} is not installed.`, createdAt: now, appLaunchAttemptRef });
      }

      const launchResult = await runFixedMacOSCommand(MACOS_OPEN_BIN, ["-a", input.appName], input.abortSignal).catch(() => null);
      if (!launchResult || launchResult.exitCode !== 0) {
        return failedLocalProgramLaunch({ message: `Failed to launch ${input.appName}.`, createdAt: now, appLaunchAttemptRef });
      }

      const isReady = await waitForLocalProgramCondition({
        timeoutMs: input.timeoutMs ?? 15_000,
        abortSignal: input.abortSignal,
        isReady: isGovernedAppRunning,
      });

      if (!isReady) {
        return failedLocalProgramLaunch({ message: `${input.appName} did not become ready in time.`, createdAt: now, appLaunchAttemptRef });
      }

      return {
        localProgramActionId: appLaunchAttemptRef,
        ok: true,
        message: `${input.appName} launched successfully.`,
        createdAt: now,
        appLaunchAttemptRef,
        windowHandoffRef: `window-handoff:${appLaunchAttemptRef}`,
        localAppStateHandoffRef: `state-handoff:${appLaunchAttemptRef}`,
        portKind: "open-local-program-port",
      };
    },

    async getLocalProgramSnapshot(input) {
      const isInstalled = isGovernedAppInstalled();
      const isRunning = isInstalled && await isGovernedAppRunning();
      return {
        appName: input.appName,
        bundleId: input.bundleId,
        visibleWindowAvailable: isRunning,
        windowTitle: isRunning ? input.appName : null,
        windowHandoffRef: isRunning ? `window-handoff:${GOVERNED_TARGET_PROFILE_REF}` : null,
        localAppStateHandoffRef: isRunning ? `state-handoff:${GOVERNED_TARGET_PROFILE_REF}` : null,
        snapshotFailureReason: isRunning ? null : `${input.appName} is not running.`,
      };
    },
  };
}
