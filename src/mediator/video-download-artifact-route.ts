import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import {
  runVideoDownloadArtifactFlow,
  VideoDownloadArtifactJobInputSchema,
  type VideoDownloadArtifactJobInput,
  type VideoDownloadArtifactJobResult,
} from "../plugins/video-download-artifact/index.js";

export const routeVideoDownloadArtifactJob = async (
  request: VideoDownloadArtifactJobInput,
  workbench: GrassEyeWorkbenchHandle,
): Promise<VideoDownloadArtifactJobResult> => {
  const input = VideoDownloadArtifactJobInputSchema.parse(request);
  return runVideoDownloadArtifactFlow(input, {
    videoDownload: workbench.getVideoDownloadAbilityGroup(),
  });
};
