import path from "node:path";

import {
  createBrowserControllerScreenshotCapturePort,
  createFilesystemScreenshotArtifactPort,
  createSharpScreenshotImageProcessingPort,
  createSystemScreenshotClockPort,
} from "../../capabilities/screenshot/adapters/index.js";
import { createScreenshotAbilityGroup } from "../../capabilities/screenshot/index.js";
import type { BrowserController } from "../browser/browser-controller.js";
import type { EvidenceStoreService } from "../storage/evidence-store/evidence-store-service.js";

export const createScreenshotRuntime = (runtime: {
  browserController: BrowserController;
  evidenceStore: EvidenceStoreService;
}) => ({
  screenshotAbilityGroup: createScreenshotAbilityGroup({
    capturePort: createBrowserControllerScreenshotCapturePort(runtime.browserController),
    artifactPort: createFilesystemScreenshotArtifactPort(path.join(runtime.evidenceStore.getDataDir(), "artifacts", "screenshot")),
    imageProcessingPort: createSharpScreenshotImageProcessingPort(),
    clockPort: createSystemScreenshotClockPort(),
  }),
});