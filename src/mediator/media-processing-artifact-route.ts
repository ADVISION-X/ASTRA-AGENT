import {
  MediaProcessingArtifactJobInputSchema,
  runMediaProcessingArtifactFlow,
  type MediaProcessingArtifactJobInput,
  type MediaProcessingArtifactJobResult,
} from "../plugins/media-processing-artifact/index.js";

export const routeMediaProcessingArtifactJob = async (
  request: MediaProcessingArtifactJobInput,
  runtime: Parameters<typeof runMediaProcessingArtifactFlow>[1],
): Promise<MediaProcessingArtifactJobResult> => {
  const input = MediaProcessingArtifactJobInputSchema.parse(request);
  return runMediaProcessingArtifactFlow(input, runtime);
};
