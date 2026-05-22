import path from "node:path";

import type { VideoDownloadAbilityGroup, VideoDownloadResult } from "../../capabilities/video-download/index.js";

import { FACEBOOK_PRODUCT_VIDEO_MINING_VIDEO_DIR } from "./facebook-product-video-mining.storage-schema.js";

export type SuccessfulVideoDownload = VideoDownloadResult & {
  status: "success";
  output: Extract<VideoDownloadResult["output"], { status: "success" }>;
  failureReason: null;
  reviewRequiredReason: null;
};

export const buildVideoArtifactRef = (downloaded: SuccessfulVideoDownload) => ({
  artifactRef: downloaded.output.artifactRef,
  storageRef: downloaded.output.storageRef,
  filePath: downloaded.output.filePath,
  sha256: downloaded.output.sha256,
  artifactDisposition: downloaded.output.artifactDisposition,
});

export const buildPromotedVideoResult = (input: {
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

export const buildSuccessfulDownloadStageSummary = (downloaded: SuccessfulVideoDownload) => ({
  durationMs: 0,
  refs: { artifactRef: downloaded.output.artifactRef },
  hashes: { sha256: downloaded.output.sha256 },
  metrics: { byteSize: downloaded.output.byteSize },
  payload: { disposition: downloaded.output.artifactDisposition },
});

export const buildPromotedVideoDestinationPath = (input: {
  dataDir: string;
  missionId: string;
  runId: string;
  videoId: string;
  filePath: string;
}): string => {
  const extension = path.extname(input.filePath) || ".mp4";
  return path.join(
    input.dataDir,
    FACEBOOK_PRODUCT_VIDEO_MINING_VIDEO_DIR,
    input.missionId,
    input.runId,
    `${input.videoId}${extension}`,
  );
};

export const buildArtifactStageSummary = (input: {
  artifactRef: string;
  sha256: string;
  byteSize: number;
  disposition: string;
  action: string;
  artifactPayload: {
    recoveryTrail: string;
    beforeHash: string;
    afterHash: string;
  };
}) => ({
  durationMs: 0,
  refs: { artifactRef: input.artifactRef },
  hashes: { sha256: input.sha256 },
  metrics: { byteSize: input.byteSize },
  payload: {
    disposition: input.disposition,
    action: input.action,
    ...input.artifactPayload,
  },
});