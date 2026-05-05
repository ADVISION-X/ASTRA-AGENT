import { existsSync } from "node:fs";

import type { OpenLocalProgramPort } from "../../capabilities/open/index.js";
import {
  GOVERNED_APP_NAME,
  GOVERNED_BUNDLE_ID,
  GOVERNED_LAUNCH_METHOD,
  GOVERNED_TARGET_PROFILE_REF,
  MACOS_OPEN_BIN,
} from "./open-local-program-adapter-constants.js";
import { failedLocalProgramLaunch } from "./open-local-program-adapter-results.js";
import {
  isGovernedAppInstalled,
  isGovernedAppRunning,
  runFixedMacOSCommand,
  waitForLocalProgram,
} from "./open-local-program-adapter-system.js";

type Readiness = {
  ok: boolean;
  code: string;
  detail: string;
};

const buildRef = (prefix: string, input: { runId: string; idempotencyKey: string }) =>
  `${prefix}:${input.runId}:${input.idempotencyKey}:${GOVERNED_TARGET_PROFILE_REF}`;

const isGovernedProfile = (input: {
  childCapabilityId: string;
  platformId: string;
  targetKind: string;
  targetProfileRef: string;
  appName: string;
  bundleId: string | null;
  appPath: string | null;
  allowedLaunchMethod: string;
}) =>
  input.childCapabilityId === "open-local-program"
  && input.platformId === "macos-local"
  && input.targetKind === "local-program"
  && input.targetProfileRef === GOVERNED_TARGET_PROFILE_REF
  && input.appName === GOVERNED_APP_NAME
  && input.bundleId === GOVERNED_BUNDLE_ID
  && input.appPath === null
  && input.allowedLaunchMethod === GOVERNED_LAUNCH_METHOD;

export const getOpenLocalProgramAdapterReadiness = (): Readiness => {
  if (process.platform !== "darwin") {
    return {
      ok: false,
      code: "BLOCKED_OPEN_LOCAL_PROGRAM_PORT_NOT_CONFIGURED",
      detail: "macOS local program launch is available only on darwin runtime.",
    };
  }
  if (!existsSync(MACOS_OPEN_BIN)) {
    return {
      ok: false,
      code: "BLOCKED_OPEN_LOCAL_PROGRAM_PORT_NOT_CONFIGURED",
      detail: "Required governed macOS open binary is unavailable.",
    };
  }
  if (!isGovernedAppInstalled()) {
    return {
      ok: false,
      code: "LOCAL_PROGRAM_APP_NOT_INSTALLED",
      detail: `${GOVERNED_APP_NAME} is not discoverable through the governed macOS application registry.`,
    };
  }
  return {
    ok: true,
    code: "OPEN_LOCAL_PROGRAM_PORT_READY",
    detail: `${GOVERNED_TARGET_PROFILE_REF} is governed and launchable through OpenLocalProgramPort.`,
  };
};

export const createGovernedMacOSOpenLocalProgramAdapter = (): OpenLocalProgramPort => ({
  async openLocalProgram(input) {
    const createdAt = new Date().toISOString();
    if (!isGovernedProfile(input)) {
      return failedLocalProgramLaunch({
        message: "LOCAL_PROGRAM_PROFILE_NOT_FOUND: only macos-app:iphone-mirroring is governed for local program open",
        createdAt,
        appLaunchAttemptRef: `${input.openAttemptRef}:blocked-profile`,
      });
    }
    if (!isGovernedAppInstalled()) {
      return failedLocalProgramLaunch({
        message: "LOCAL_PROGRAM_APP_NOT_INSTALLED: governed iPhone Mirroring app is not installed or discoverable",
        createdAt,
        appLaunchAttemptRef: `${input.openAttemptRef}:missing-app`,
      });
    }

    const launch = await runFixedMacOSCommand(MACOS_OPEN_BIN, ["-b", GOVERNED_BUNDLE_ID], input.abortSignal);
    if (launch.exitCode !== 0) {
      return failedLocalProgramLaunch({
        message: `LOCAL_PROGRAM_LAUNCH_FAILED: macOS open returned ${launch.exitCode ?? "unknown"}${launch.stderr ? ` (${launch.stderr.trim()})` : ""}`,
        createdAt,
        appLaunchAttemptRef: `${input.openAttemptRef}:launch-failed`,
      });
    }

    await waitForLocalProgram(Math.min(1200, Math.max(250, input.timeoutMs / 4)), input.abortSignal);
    if (!(await isGovernedAppRunning())) {
      return failedLocalProgramLaunch({
        message: "LOCAL_PROGRAM_WINDOW_NOT_VISIBLE: governed app launch returned but no visible app process was confirmed",
        createdAt,
        appLaunchAttemptRef: `${input.openAttemptRef}:window-not-visible`,
      });
    }

    return {
      localProgramActionId: `${input.openAttemptRef}:macos-open`,
      ok: true,
      message: "governed iPhone Mirroring launch handed off to local app window chain",
      createdAt,
      appLaunchAttemptRef: `${input.openAttemptRef}:launched`,
      windowHandoffRef: buildRef("local-app-window", input),
      localAppStateHandoffRef: buildRef("local-app-state", input),
      portKind: "open-local-program-port",
    };
  },

  async getLocalProgramSnapshot(input) {
    const governed = input.targetProfileRef === GOVERNED_TARGET_PROFILE_REF
      && input.appName === GOVERNED_APP_NAME
      && input.bundleId === GOVERNED_BUNDLE_ID;
    const visibleWindowAvailable = governed && await isGovernedAppRunning();
    return {
      appName: input.appName,
      bundleId: input.bundleId,
      visibleWindowAvailable,
      windowTitle: visibleWindowAvailable ? GOVERNED_APP_NAME : null,
      windowHandoffRef: visibleWindowAvailable ? `local-app-window:snapshot:${GOVERNED_TARGET_PROFILE_REF}` : null,
      localAppStateHandoffRef: visibleWindowAvailable ? `local-app-state:snapshot:${GOVERNED_TARGET_PROFILE_REF}` : null,
      snapshotFailureReason: visibleWindowAvailable ? null : "LOCAL_PROGRAM_WINDOW_NOT_VISIBLE: governed local app window is not visible",
    };
  },
});
