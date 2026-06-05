import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import {
  MediaProcessingArtifactJobInputSchema,
  runMediaProcessingArtifactFlow,
  type MediaProcessingArtifactJobInput,
  type MediaProcessingArtifactJobResult,
} from "../plugins/media-processing-artifact/index.js";

export const routeMediaProcessingArtifactJob = async (
  request: MediaProcessingArtifactJobInput,
  workbench: GrassEyeWorkbenchHandle,
): Promise<MediaProcessingArtifactJobResult> => {
  const input = MediaProcessingArtifactJobInputSchema.parse(request);
  return runMediaProcessingArtifactFlow(input, {
    mediaProcessing: workbench.getMediaProcessingAbilityGroup(),
  });
};
