import path from "node:path";

import { CurrentChromeBrowserController } from "../browser/current-chrome-browser-controller.js";
import { resolveProductionBrowserProfileEnrollment } from "../browser/profile/browser-profile-config.js";
import { readBrowserActivationReceipt } from "../browser/release/browser-activation-receipt.js";
import {
  resolveBrowserRuntimeArtifactRoot,
  verifyBrowserArtifactSet,
} from "../browser/release/verify-browser-artifact.mjs";
import type { GrassEyeWorkbenchOptions } from "./contract.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";

export async function createWorkbenchBrowserController(
  options: GrassEyeWorkbenchOptions,
  dataDir: string,
  runtimeLogger: RuntimeLogger,
): Promise<CurrentChromeBrowserController> {
  const profileEnrollment = resolveProductionBrowserProfileEnrollment({
    platform: process.platform,
  });
  const artifactSet = await verifyBrowserArtifactSet(
    resolveBrowserRuntimeArtifactRoot(process.cwd()),
  );
  const activation = readBrowserActivationReceipt({ artifactSet });
  if (
    activation.profileEnrollmentId !== profileEnrollment.profileEnrollmentId
    || activation.profileRef !== profileEnrollment.profileRef
    || activation.userDataDir !== profileEnrollment.userDataDir
    || activation.profileDirectory !== profileEnrollment.profileDirectory
    || activation.chromeExecutablePath !== profileEnrollment.chromeExecutablePath
  ) {
    throw new Error("BROWSER_ACTIVATION_PROFILE_ENROLLMENT_MISMATCH");
  }
  return CurrentChromeBrowserController.create({
    profileEnrollment,
    screenshotDir: path.join(dataDir, "browser-captures"),
    dataDir,
    headlessRequested: options.browserHeadless === true,
    authorityTimeoutMs: 30_000,
  }, runtimeLogger);
}
