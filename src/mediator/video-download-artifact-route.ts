import {
  runVideoDownloadArtifactFlow,
  VideoDownloadArtifactJobInputSchema,
  type VideoDownloadArtifactJobInput,
  type VideoDownloadArtifactJobResult,
} from "../plugins/video-download-artifact/index.js";

export const routeVideoDownloadArtifactJob = async (
  request: VideoDownloadArtifactJobInput,
  runtime: Parameters<typeof runVideoDownloadArtifactFlow>[1],
): Promise<VideoDownloadArtifactJobResult> => {
  const input = VideoDownloadArtifactJobInputSchema.parse(request);
  return runVideoDownloadArtifactFlow(input, runtime);
};
