import path from "node:path";

import { CurrentChromeBrowserController } from "../browser/current-chrome-browser-controller.js";
import { createLocalBrowserSessionConfig } from "../browser/local-browser-session.js";
import type { GrassEyeWorkbenchOptions } from "./workbench-contract.js";

export const createBrowserRuntime = (
  options: GrassEyeWorkbenchOptions,
  dataDir: string,
) => {
  const browserSessionConfig = createLocalBrowserSessionConfig({
    platform: options.platformTarget,
    ...(options.browserProfileDirectory ? { profileDirectory: options.browserProfileDirectory } : {}),
  });
  const browserController = new CurrentChromeBrowserController({
    sessionConfig: browserSessionConfig,
    screenshotDir: path.join(dataDir, "browser-captures"),
    headlessRequested: options.browserHeadless === true,
  });
  return { browserSessionConfig, browserController };
};