import path from "node:path";

import { CurrentChromeBrowserController } from "../browser/current-chrome-browser-controller.js";
import { resolveProductionBrowserProfileEnrollment } from "../browser/profile/browser-profile-config.js";
import type { GrassEyeWorkbenchOptions } from "./contract.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";

export async function createWorkbenchBrowserController(
  options: GrassEyeWorkbenchOptions,
  dataDir: string,
  runtimeLogger: RuntimeLogger,
): Promise<CurrentChromeBrowserController> {
  const profileEnrollment = resolveProductionBrowserProfileEnrollment({
    platform: options.platformTarget,
    ...(options.browserProfileDirectory
      ? { profileDirectory: options.browserProfileDirectory }
      : {}),
  });
  return CurrentChromeBrowserController.create({
    profileEnrollment,
    screenshotDir: path.join(dataDir, "browser-captures"),
    dataDir,
    headlessRequested: options.browserHeadless === true,
    authorityTimeoutMs: 30_000,
  }, runtimeLogger);
}
