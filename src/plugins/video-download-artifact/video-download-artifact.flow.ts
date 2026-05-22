import { createId } from "../../lib/local-runtime/ids.js";
import type { VideoDownloadAbilityGroup } from "../../capabilities/video-download/index.js";
import { VideoDownloadArtifactJobResultSchema, type VideoDownloadArtifactJobResult } from "./video-download-artifact.result.js";
import {
  VideoDownloadArtifactJobInputSchema,
  type VideoDownloadArtifactJobInput,
} from "./video-download-artifact.schema.js";

export type VideoDownloadArtifactFlowContext = {
  videoDownload: VideoDownloadAbilityGroup;
};

export const runVideoDownloadArtifactFlow = async (
  input: VideoDownloadArtifactJobInput,
  context: VideoDownloadArtifactFlowContext,
): Promise<VideoDownloadArtifactJobResult> => {
  const jobInput = VideoDownloadArtifactJobInputSchema.parse(input);
  const result = await context.videoDownload.execute({
    abilityGroupId: "video-download",
    childCapabilityId: jobInput.childCapabilityId,
    missionId: createId("video_download_job"),
    runId: createId("video_download_run"),
    capabilityCallId: createId("video_download_call"),
    sourcePageUrl: jobInput.sourcePageUrl,
    preferredQuality: jobInput.preferredQuality,
    maxBytes: jobInput.maxBytes,
    timeoutMs: jobInput.timeoutMs,
    artifactDisposition: "final",
    downloadSubtitles: jobInput.downloadSubtitles,
    subtitleLanguages: jobInput.subtitleLanguages,
  });

  return VideoDownloadArtifactJobResultSchema.parse({
    jobType: "video-download-artifact",
    status: result.status,
    result,
  });
};
