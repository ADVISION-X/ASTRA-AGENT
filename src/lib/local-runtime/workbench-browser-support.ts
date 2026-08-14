import path from "node:path";

import { CurrentChromeBrowserController } from "../browser/current-chrome-browser-controller.js";
import { createLocalBrowserSessionConfig } from "../browser/local-browser-session.js";
import type { GrassEyeWorkbenchOptions } from "./contract.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";

export function createWorkbenchBrowserController(
  options: GrassEyeWorkbenchOptions,
  dataDir: string,
  runtimeLogger: RuntimeLogger,
): CurrentChromeBrowserController {
  const browserSessionConfig = createLocalBrowserSessionConfig({
    platform: options.platformTarget,
    ...(options.browserProfileDirectory
      ? { profileDirectory: options.browserProfileDirectory }
      : {}),
  });
  return new CurrentChromeBrowserController({
    sessionConfig: browserSessionConfig,
    screenshotDir: path.join(dataDir, "browser-captures"),
    dataDir,
    headlessRequested: options.browserHeadless === true,
  }, runtimeLogger);
}
