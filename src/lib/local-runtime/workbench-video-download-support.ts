import {
  createFilesystemVideoArtifactStoragePort,
  createVideoDownloadAbilityGroup,
} from "../../capabilities/video-download/index.js";
import type { BrowserController } from "../browser/browser-controller.js";

export function createWorkbenchVideoDownload(
  dataDir: string,
  browserController: BrowserController,
) {
  return createVideoDownloadAbilityGroup({
    browserMediaSourcePort: browserController,
    artifactStoragePort: createFilesystemVideoArtifactStoragePort(dataDir),
  });
}