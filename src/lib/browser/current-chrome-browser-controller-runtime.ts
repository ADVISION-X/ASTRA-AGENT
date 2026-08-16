import path from "node:path";

import type { LocalBrowserSessionConfig } from "../../types/local-browser-session.js";
import { createId } from "../local-runtime/ids.js";
import type { BrowserController, BrowserStateSnapshot } from "./browser-controller.js";
import { BrowserCommandRuntime } from "./exact-target/browser-command-runtime.js";
import { createInitialLocalBrowserSessionState } from "./local-browser-session.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";

export type CurrentChromeBrowserControllerOptions = {
  sessionConfig: LocalBrowserSessionConfig;
  screenshotDir: string;
  dataDir: string;
  headlessRequested?: boolean;
};

export const createCurrentChromeBrowserControllerRuntime = (
  options: CurrentChromeBrowserControllerOptions,
  runtimeLogger?: RuntimeLogger,
): BrowserController => {
  if (options.headlessRequested === true) {
    throw new Error("Real-platform mode forbids headless browser launch; use the authorized local Chrome profile.");
  }
  const commandRuntime = new BrowserCommandRuntime(
    createId("browser-controller-session"),
    path.join(options.dataDir, "browser-runtime", "controller-native.sock"),
    options.screenshotDir,
    runtimeLogger,
  );
  const initial = createInitialLocalBrowserSessionState(options.sessionConfig);

  const snapshot = (): BrowserStateSnapshot => ({
    ...initial,
    profileStatus: "profile_ready",
    profileVerificationStatus: "operator_verified",
    profileVerificationReason: "authorized local Chrome profile is controlled through the fixed GrassEye extension",
    open: commandRuntime.targetCount() > 0,
    currentUrl: "exact-target-only",
    currentTitle: "GrassEye exact target controller",
    browserExecutable: options.sessionConfig.chromeExecutablePath,
    exactTargetCount: commandRuntime.targetCount(),
    transportReady: commandRuntime.isReady(),
  });

  return {
    setExecutionAbortSignal: (signal) => commandRuntime.setExecutionAbortSignal(signal),
    getHealth: () => ({
      ok: commandRuntime.isReady(),
      detail: commandRuntime.isReady()
        ? `exact target transport ready; ${commandRuntime.targetCount()} target session(s)`
        : "waiting for fixed-id GrassEye MV3 extension and Native Messaging host",
    }),
    getSessionState: snapshot,
    createTargetSession: (ownerId) => commandRuntime.createTargetSession(ownerId),
    close: async () => {
      await commandRuntime.close();
      return { browserActionId: createId("browser-controller-close"), ok: true, message: "exact target BrowserController transport closed", createdAt: new Date().toISOString() };
    },
  };
};
