import path from "node:path";

import type { BrowserController } from "../../lib/browser/browser-controller.js";
import { createScreenshotAbilityGroup } from "./ability-group.js";
import { createBrowserControllerCapturePort } from "./adapters/browser-controller-capture-adapter.js";
import { createFilesystemArtifactStoragePort } from "./runtime/artifact-write.js";

type WorkbenchScreenshotRuntime = {
  browserController: BrowserController;
  evidenceStore: { getDataDir(): string };
};

export function createWorkbenchScreenshotAbilityGroup(runtime: WorkbenchScreenshotRuntime) {
  return createScreenshotAbilityGroup({
    browserCapture: createBrowserControllerCapturePort(runtime.browserController),
    artifactStorage: createFilesystemArtifactStoragePort(
      path.join(runtime.evidenceStore.getDataDir(), "artifacts", "screenshot"),
    ),
  });
}
