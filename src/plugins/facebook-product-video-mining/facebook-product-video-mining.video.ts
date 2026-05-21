import path from "node:path";

import type { VideoDownloadAbilityGroup, VideoDownloadResult } from "../../capabilities/video-download/index.js";
import { FACEBOOK_PRODUCT_VIDEO_MINING_VIDEO_DIR } from "./facebook-product-video-mining.storage-schema.js";

type SuccessfulVideoDownload = VideoDownloadResult & {
  status: "success";
  output: Extract<VideoDownloadResult["output"], { status: "success" }>;
  failureReason: null;
  reviewRequiredReason: null;
};

const isSuccessfulVideoDownload = (
  downloaded: VideoDownloadResult,
): downloaded is SuccessfulVideoDownload => downloaded.status === "success" && downloaded.output.status === "success";

const buildVideoArtifactRef = (downloaded: SuccessfulVideoDownload) => {
  return {
    artifactRef: downloaded.output.artifactRef,
    storageRef: downloaded.output.storageRef,
    filePath: downloaded.output.filePath,
    sha256: downloaded.output.sha256,
    artifactDisposition: downloaded.output.artifactDisposition,
  };
};

const buildPromotedVideoResult = (input: {
  downloaded: SuccessfulVideoDownload;
  artifact: Awaited<ReturnType<VideoDownloadAbilityGroup["promoteArtifact"]>>;
}): VideoDownloadResult => ({
  ...input.downloaded,
  output: {
    ...input.downloaded.output,
    artifactRef: input.artifact.artifactRef,
    storageRef: input.artifact.storageRef,
    filePath: input.artifact.filePath,
    sha256: input.artifact.sha256,
    artifactDisposition: input.artifact.artifactDisposition,
  },
  runtimeProof: {
    ...input.downloaded.runtimeProof,
    artifactRef: input.artifact.artifactRef,
    sha256: input.artifact.sha256,
    artifactDisposition: input.artifact.artifactDisposition,
  },
});

export const downloadCurrentFacebookVideo = async (input: {
  videoDownload: VideoDownloadAbilityGroup;
  missionId: string;
  runId: string;
  roundId: string;
  sourcePageUrl: string;
  preferredQuality: "hd" | "sd" | "best_available";
  maxVideoBytes: number;
}): Promise<VideoDownloadResult> => input.videoDownload.execute({
    abilityGroupId: "video-download",
    childCapabilityId: "download-facebook-video-once",
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    capabilityCallId: `${input.roundId}_download`,
    sourcePageUrl: input.sourcePageUrl,
    preferredQuality: input.preferredQuality,
    maxBytes: input.maxVideoBytes,
    timeoutMs: 60_000,
    artifactDisposition: "staging",
  });

export const promoteAcceptedFacebookVideo = async (input: {
  videoDownload: VideoDownloadAbilityGroup;
  dataDir: string;
  missionId: string;
  runId: string;
  videoId: string;
  downloaded: VideoDownloadResult;
}): Promise<VideoDownloadResult | null> => {
  if (!isSuccessfulVideoDownload(input.downloaded)) {
    return null;
  }
  const artifactRef = buildVideoArtifactRef(input.downloaded);
  const extension = path.extname(artifactRef.filePath) || ".mp4";
  const destinationFilePath = path.join(
    input.dataDir,
    FACEBOOK_PRODUCT_VIDEO_MINING_VIDEO_DIR,
    input.missionId,
    input.runId,
    `${input.videoId}${extension}`,
  );
  const artifact = await input.videoDownload.promoteArtifact({
    artifact: artifactRef,
    destinationFilePath,
  });
  return buildPromotedVideoResult({ downloaded: input.downloaded, artifact });
};

export const deleteRejectedFacebookVideo = async (input: {
  videoDownload: VideoDownloadAbilityGroup;
  downloaded: VideoDownloadResult;
}): Promise<void> => {
  if (!isSuccessfulVideoDownload(input.downloaded)) {
    return;
  }
  const artifactRef = buildVideoArtifactRef(input.downloaded);
  await input.videoDownload.deleteArtifact({
    artifact: artifactRef,
  });
};