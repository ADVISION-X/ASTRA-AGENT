import path from "node:path";

import { createFilesystemScreenshotArtifactPort } from "../adapters/filesystem-screenshot-artifact-port.js";
import { createBrowserControllerScreenshotCapturePort } from "../adapters/browser-controller-screenshot-capture-port.js";
import { createSharpScreenshotImageProcessingPort } from "../adapters/sharp-screenshot-image-processing-port.js";
import { createScreenshotAbilityGroup } from "../ability-group.js";
import { createSystemScreenshotClockPort } from "./system-screenshot-clock-port.js";

type WorkbenchScreenshotRuntime = {
  browserController: Parameters<typeof createBrowserControllerScreenshotCapturePort>[0];
  evidenceStore: {
    getDataDir(): string;
  };
};

export const createWorkbenchScreenshotAbilityGroup = (runtime: WorkbenchScreenshotRuntime) =>
  createScreenshotAbilityGroup({
    capturePort: createBrowserControllerScreenshotCapturePort(runtime.browserController),
    artifactPort: createFilesystemScreenshotArtifactPort(path.join(runtime.evidenceStore.getDataDir(), "artifacts", "screenshot")),
    imageProcessingPort: createSharpScreenshotImageProcessingPort(),
    clockPort: createSystemScreenshotClockPort(),
  });