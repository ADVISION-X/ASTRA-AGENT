import { randomUUID } from "node:crypto";

import {
  VIDEO_DOWNLOAD_ABILITY_GROUP_ID,
  VideoDownloadResultSchema,
  type ParsedVideoDownloadAbilityInput,
  type VideoDownloadCandidate,
  type VideoDownloadFailureReason,
  type VideoDownloadPlatformId,
  type VideoDownloadResult,
} from "../schema.js";
import { routeToChildCapability } from "./platform-router.js";

const CHILD_TO_PLATFORM: Record<string, VideoDownloadPlatformId> = {
  "download-web-video-once": "universal-web",
  "download-facebook-video-once": "facebook-web",
  "download-tiktok-video-once": "tiktok-web",
  "download-instagram-video-once": "instagram-web",
  "download-bilibili-video-once": "bilibili-web",
  "download-douyin-video-once": "douyin-web",
  "download-x-video-once": "x-web",
  "download-xiaohongshu-video-once": "xiaohongshu-web",
};

const resolvePlatformId = (input: ParsedVideoDownloadAbilityInput): VideoDownloadPlatformId => {
  if (input.childCapabilityId === "download-web-video-once") {
    const routed = routeToChildCapability(input.sourcePageUrl);
    return CHILD_TO_PLATFORM[routed] ?? "universal-web";
  }
  return CHILD_TO_PLATFORM[input.childCapabilityId] ?? "universal-web";
};

type ResultBaseInput = {
  input: ParsedVideoDownloadAbilityInput;
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

const buildProofIdentity = (base: ResultBaseInput, status: VideoDownloadResult["status"]) => ({
  proofId: proofId(),
  missionId: base.input.missionId,
  runId: base.input.runId,
  sessionId: base.input.sessionId ?? null,
  roundId: base.input.roundId ?? null,
  capabilityCallId: base.input.capabilityCallId,
  abilityGroupId: VIDEO_DOWNLOAD_ABILITY_GROUP_ID,
  childCapabilityId: base.input.childCapabilityId,
  sourcePageUrl: base.input.sourcePageUrl,
  platformId: resolvePlatformId(base.input),
  status,
  selectedQuality: base.input.preferredQuality,
});

const buildProofCandidateDetails = (base: ResultBaseInput) => ({
  candidateKind: base.candidate?.kind ?? null,
  candidateHost: base.candidateHost ?? null,
  contentType: base.contentType ?? null,
  byteSize: base.byteSize ?? null,
  durationMs: base.durationMs ?? null,
  width: base.width ?? null,
  height: base.height ?? null,
  artifactRef: base.artifactRef ?? null,
});

const baseProof = (base: ResultBaseInput, status: VideoDownloadResult["status"], endedAt: string) => ({
  ...buildProofIdentity(base, status),
  ...buildProofCandidateDetails(base),
  startedAt: base.startedAt,
  endedAt,
  durationMsTotal: elapsedMs(base.startedAt, endedAt),
});

const buildFailureOutput = (
  base: ResultBaseInput,
  runtimeProof: ReturnType<typeof baseProof> & { reviewRequiredReason: string | null },
  failureReason: VideoDownloadFailureReason,
  reason: string,
  status: "failed" | "review_required" | "invalid_input",
) => ({
  status,
  platformId: runtimeProof.platformId,
  sourcePageUrl: base.input.sourcePageUrl,
  errorCode: failureReason,
  reason,
  proofRef: runtimeProof.proofId,
});

const buildSuccessOutput = (
  base: ResultBaseInput & {
    artifactRef: string;
    storageRef: string;
    filePath: string;
    videoId: string | null;
  },
  runtimeProof: ReturnType<typeof baseProof> & { failureReason: null; reviewRequiredReason: null },
  endedAt: string,
) => ({
  status: "success" as const,
  platformId: runtimeProof.platformId,
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
    childCapabilityId: base.input.childCapabilityId,
    status,
    failureReason,
    reviewRequiredReason: runtimeProof.reviewRequiredReason,
    output: buildFailureOutput(base, runtimeProof, failureReason, reason, status),
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
    childCapabilityId: base.input.childCapabilityId,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    output: buildSuccessOutput(base, runtimeProof, endedAt),
    runtimeProof,
  });
};

