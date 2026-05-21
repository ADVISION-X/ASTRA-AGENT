import { randomUUID } from "node:crypto";

import {
  VIDEO_DOWNLOAD_ABILITY_GROUP_ID,
  VideoDownloadResultSchema,
  type ParsedDownloadFacebookVideoInput,
  type VideoDownloadCandidate,
  type VideoDownloadFailureReason,
  type VideoDownloadResult,
} from "../schema.js";

type ResultBaseInput = {
  input: ParsedDownloadFacebookVideoInput;
  startedAt: string;
  candidate?: VideoDownloadCandidate;
  candidateHost?: string | null;
  contentType?: string | null;
  byteSize?: number | null;
  durationMs?: number | null;
  width?: number | null;
  height?: number | null;
  artifactRef?: string | null;
};

const elapsedMs = (startedAt: string, endedAt: string): number =>
  Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));

const proofId = (): string => `vd_proof_${randomUUID()}`;

const baseProof = (base: ResultBaseInput, status: VideoDownloadResult["status"], endedAt: string) => ({
  proofId: proofId(),
  missionId: base.input.missionId,
  runId: base.input.runId,
  sessionId: base.input.sessionId ?? null,
  roundId: base.input.roundId ?? null,
  capabilityCallId: base.input.capabilityCallId,
  abilityGroupId: VIDEO_DOWNLOAD_ABILITY_GROUP_ID,
  childCapabilityId: "download-facebook-video-once" as const,
  sourcePageUrl: base.input.sourcePageUrl,
  platformId: "facebook-web" as const,
  status,
  candidateKind: base.candidate?.kind ?? null,
  candidateHost: base.candidateHost ?? null,
  contentType: base.contentType ?? null,
  byteSize: base.byteSize ?? null,
  durationMs: base.durationMs ?? null,
  width: base.width ?? null,
  height: base.height ?? null,
  selectedQuality: base.input.preferredQuality,
  artifactRef: base.artifactRef ?? null,
  startedAt: base.startedAt,
  endedAt,
  durationMsTotal: elapsedMs(base.startedAt, endedAt),
});

export const buildVideoDownloadFailure = (
  base: ResultBaseInput,
  failureReason: VideoDownloadFailureReason,
  reason: string,
  status: "failed" | "review_required" | "invalid_input" = "failed",
): VideoDownloadResult => {
  const endedAt = new Date().toISOString();
  const runtimeProof = {
    ...baseProof(base, status, endedAt),
    failureReason,
    reviewRequiredReason: status === "review_required" ? reason : null,
  };
  return VideoDownloadResultSchema.parse({
    abilityGroupId: VIDEO_DOWNLOAD_ABILITY_GROUP_ID,
    childCapabilityId: "download-facebook-video-once",
    status,
    failureReason,
    reviewRequiredReason: runtimeProof.reviewRequiredReason,
    output: {
      status,
      platformId: "facebook-web",
      sourcePageUrl: base.input.sourcePageUrl,
      errorCode: failureReason,
      reason,
      proofRef: runtimeProof.proofId,
    },
    runtimeProof,
  });
};

export const buildVideoDownloadSuccess = (
  base: ResultBaseInput & {
    artifactRef: string;
    storageRef: string;
    filePath: string;
    videoId: string | null;
  },
): VideoDownloadResult => {
  const endedAt = new Date().toISOString();
  const runtimeProof = {
    ...baseProof(base, "success", endedAt),
    failureReason: null,
    reviewRequiredReason: null,
  };
  return VideoDownloadResultSchema.parse({
    abilityGroupId: VIDEO_DOWNLOAD_ABILITY_GROUP_ID,
    childCapabilityId: "download-facebook-video-once",
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    output: {
      status: "success",
      platformId: "facebook-web",
      sourcePageUrl: base.input.sourcePageUrl,
      videoId: base.videoId,
      artifactRef: base.artifactRef,
      storageRef: base.storageRef,
      filePath: base.filePath,
      contentType: base.contentType ?? "video/mp4",
      byteSize: base.byteSize ?? 0,
      durationMs: base.durationMs ?? null,
      width: base.width ?? null,
      height: base.height ?? null,
      selectedQuality: base.input.preferredQuality,
      candidateKind: base.candidate?.kind ?? "media_resource",
      downloadedAt: endedAt,
      proofRef: runtimeProof.proofId,
    },
    runtimeProof,
  });
};
