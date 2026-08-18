import path from "node:path";

import { createId } from "../local-runtime/ids.js";
import type { BrowserController } from "./browser-controller.js";
import { BrowserCommandRuntime } from "./exact-target/browser-command-runtime.js";
import type { BrowserProfileEnrollment } from "./profile/browser-profile-enrollment.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";

export type CurrentChromeBrowserControllerOptions = {
  profileEnrollment: BrowserProfileEnrollment;
  screenshotDir: string;
  dataDir: string;
  headlessRequested?: boolean;
  authorityTimeoutMs?: number;
};

export const createCurrentChromeBrowserControllerRuntime = async (
  options: CurrentChromeBrowserControllerOptions,
  runtimeLogger?: RuntimeLogger,
): Promise<BrowserController> => {
  if (options.headlessRequested === true) {
    throw new Error("Real-platform mode forbids headless browser launch; use the enrolled production Chrome profile.");
  }
  const commandRuntime = await BrowserCommandRuntime.create({
    controllerSessionId: createId("browser-controller-authority"),
    socketPath: path.join(options.dataDir, "browser-runtime", "controller-native.sock"),
    screenshotDir: options.screenshotDir,
    profileEnrollment: options.profileEnrollment,
    approvedFileRoots: [options.dataDir],
    ...(runtimeLogger ? { runtimeLogger } : {}),
    ...(options.authorityTimeoutMs ? { authorityTimeoutMs: options.authorityTimeoutMs } : {}),
  });

  return {
    setExecutionAbortSignal: (signal) => commandRuntime.setExecutionAbortSignal(signal),
    getHealth: () => {
      const authority = commandRuntime.authoritySnapshot();
      return authority.state === "AUTHENTICATED_AUTHORITY_PRESENT"
        ? {
            ok: true,
            detail: `authenticated browser authority present; ${commandRuntime.targetCount()} exact target lease(s)`,
          }
        : {
            ok: false,
            detail: `browser authority absent: ${authority.reason}`,
          };
    },
    getAuthoritySnapshot: () => commandRuntime.authoritySnapshot(),
    createTargetSession: (ownerId) => commandRuntime.createTargetSession(ownerId),
    close: async () => {
      await commandRuntime.close();
      return {
        browserActionId: createId("browser-controller-close"),
        ok: true,
        message: "authenticated BrowserController authority closed",
        createdAt: new Date().toISOString(),
      };
    },
  };
};
