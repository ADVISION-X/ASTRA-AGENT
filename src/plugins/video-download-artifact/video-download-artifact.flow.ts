import { createId } from "../../lib/local-runtime/ids.js";
import type { VideoDownloadAbilityGroup } from "../../capabilities/video-download/index.js";
import { VideoDownloadArtifactJobResultSchema, type VideoDownloadArtifactJobResult } from "./video-download-artifact.result.js";
import {
  VideoDownloadArtifactJobInputSchema,
  type VideoDownloadArtifactJobInput,
} from "./video-download-artifact.schema.js";

type VideoDownloadArtifactFlowContext = {
  videoDownload: VideoDownloadAbilityGroup;
};

export const runVideoDownloadArtifactFlow = async (
  input: VideoDownloadArtifactJobInput,
  context: VideoDownloadArtifactFlowContext,
): Promise<VideoDownloadArtifactJobResult> => {
  const jobInput = VideoDownloadArtifactJobInputSchema.parse(input);
  const result = await context.videoDownload.downloadVideo({
    missionId: createId("video_download_job"),
    runId: createId("video_download_run"),
    sourcePageUrl: jobInput.sourcePageUrl,
    platform: jobInput.platform,
    preferredQuality: jobInput.preferredQuality,
    maxBytes: jobInput.maxBytes,
    timeoutMs: jobInput.timeoutMs,
    artifactPolicy: "deliverable",
    downloadSubtitles: jobInput.downloadSubtitles,
    subtitleLanguages: jobInput.subtitleLanguages,
    ...(jobInput.telegramDocumentIdHash ? { telegramDocumentIdHash: jobInput.telegramDocumentIdHash } : {}),
  });

  return VideoDownloadArtifactJobResultSchema.parse({
    jobType: "video-download-artifact",
    status: result.status,
    result,
  });
};
