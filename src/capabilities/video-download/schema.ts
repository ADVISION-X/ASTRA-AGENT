import { z } from "zod";

export const VIDEO_DOWNLOAD_ABILITY_GROUP_ID = "video-download" as const;

export const VideoDownloadChildCapabilityIdSchema = z.enum([
  "download-facebook-video-once",
]);

export const VideoDownloadPreferredQualitySchema = z.enum([
  "hd",
  "sd",
  "best_available",
]);

export const VideoDownloadStatusSchema = z.enum([
  "success",
  "failed",
  "review_required",
  "invalid_input",
]);

export const VideoDownloadFailureReasonSchema = z.enum([
  "input_schema_invalid",
  "unknown_child_capability",
  "source_page_mismatch",
  "candidate_not_found",
  "candidate_not_video",
  "candidate_host_forbidden",
  "download_expired",
  "login_required",
  "captcha_or_2fa_required",
  "drm_or_private_video",
  "permission_denied",
  "network_failed",
  "metadata_validation_failed",
  "artifact_write_failed",
]);

export const VideoDownloadCandidateKindSchema = z.enum([
  "native_hd",
  "native_sd",
  "video_element",
  "media_resource",
  "dash_manifest",
]);

export const VideoDownloadCandidateSchema = z.object({
  kind: VideoDownloadCandidateKindSchema,
  url: z.string().url(),
  source: z.string().min(1),
  quality: z.enum(["hd", "sd", "unknown"]),
}).strict();

export const DownloadFacebookVideoInputSchema = z.object({
  abilityGroupId: z.literal(VIDEO_DOWNLOAD_ABILITY_GROUP_ID).default(VIDEO_DOWNLOAD_ABILITY_GROUP_ID),
  childCapabilityId: z.literal("download-facebook-video-once"),
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  roundId: z.string().min(1).optional(),
  capabilityCallId: z.string().min(1),
  sourcePageUrl: z.string().url(),
  preferredQuality: VideoDownloadPreferredQualitySchema.default("best_available"),
  maxBytes: z.number().int().min(1024).max(250_000_000).default(100_000_000),
  timeoutMs: z.number().int().min(1000).max(120_000).default(30_000),
}).strict();

export const VideoDownloadAbilityInputSchema = z.discriminatedUnion("childCapabilityId", [
  DownloadFacebookVideoInputSchema,
]);

export const VideoDownloadArtifactSchema = z.object({
  artifactRef: z.string().min(1),
  storageRef: z.string().min(1),
  filePath: z.string().min(1),
  sha256: z.string().min(64).max(64),
}).strict();

export const VideoDownloadProofSchema = z.object({
  proofId: z.string().min(1),
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1).nullable(),
  roundId: z.string().min(1).nullable(),
  capabilityCallId: z.string().min(1),
  abilityGroupId: z.literal(VIDEO_DOWNLOAD_ABILITY_GROUP_ID),
  childCapabilityId: VideoDownloadChildCapabilityIdSchema,
  sourcePageUrl: z.string().url(),
  platformId: z.literal("facebook-web"),
  status: VideoDownloadStatusSchema,
  failureReason: VideoDownloadFailureReasonSchema.nullable(),
  reviewRequiredReason: z.string().min(1).nullable(),
  candidateKind: VideoDownloadCandidateKindSchema.nullable(),
  candidateHost: z.string().min(1).nullable(),
  contentType: z.string().min(1).nullable(),
  byteSize: z.number().int().nonnegative().nullable(),
  durationMs: z.number().nonnegative().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  selectedQuality: z.enum(["hd", "sd", "best_available", "unknown"]),
  artifactRef: z.string().min(1).nullable(),
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  durationMsTotal: z.number().nonnegative(),
}).strict();

export const VideoDownloadSuccessOutputSchema = z.object({
  status: z.literal("success"),
  platformId: z.literal("facebook-web"),
  sourcePageUrl: z.string().url(),
  videoId: z.string().min(1).nullable(),
  artifactRef: z.string().min(1),
  storageRef: z.string().min(1),
  filePath: z.string().min(1),
  contentType: z.string().min(1),
  byteSize: z.number().int().positive(),
  durationMs: z.number().nonnegative().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  selectedQuality: z.enum(["hd", "sd", "best_available", "unknown"]),
  candidateKind: VideoDownloadCandidateKindSchema,
  downloadedAt: z.string().min(1),
  proofRef: z.string().min(1),
}).strict();

export const VideoDownloadFailureOutputSchema = z.object({
  status: z.enum(["failed", "review_required", "invalid_input"]),
  platformId: z.literal("facebook-web"),
  sourcePageUrl: z.string().url(),
  errorCode: VideoDownloadFailureReasonSchema,
  reason: z.string().min(1),
  proofRef: z.string().min(1),
}).strict();

export const VideoDownloadResultSchema = z.object({
  abilityGroupId: z.literal(VIDEO_DOWNLOAD_ABILITY_GROUP_ID),
  childCapabilityId: VideoDownloadChildCapabilityIdSchema,
  status: VideoDownloadStatusSchema,
  failureReason: VideoDownloadFailureReasonSchema.nullable(),
  reviewRequiredReason: z.string().min(1).nullable(),
  output: z.union([
    VideoDownloadSuccessOutputSchema,
    VideoDownloadFailureOutputSchema,
  ]),
  runtimeProof: VideoDownloadProofSchema,
}).strict();

export type VideoDownloadChildCapabilityId = z.infer<typeof VideoDownloadChildCapabilityIdSchema>;
export type VideoDownloadPreferredQuality = z.infer<typeof VideoDownloadPreferredQualitySchema>;
export type VideoDownloadStatus = z.infer<typeof VideoDownloadStatusSchema>;
export type VideoDownloadFailureReason = z.infer<typeof VideoDownloadFailureReasonSchema>;
export type VideoDownloadCandidateKind = z.infer<typeof VideoDownloadCandidateKindSchema>;
export type VideoDownloadCandidate = z.infer<typeof VideoDownloadCandidateSchema>;
export type DownloadFacebookVideoInput = z.input<typeof DownloadFacebookVideoInputSchema>;
export type ParsedDownloadFacebookVideoInput = z.output<typeof DownloadFacebookVideoInputSchema>;
export type VideoDownloadAbilityInput = z.input<typeof VideoDownloadAbilityInputSchema>;
export type ParsedVideoDownloadAbilityInput = z.output<typeof VideoDownloadAbilityInputSchema>;
export type VideoDownloadArtifact = z.infer<typeof VideoDownloadArtifactSchema>;
export type VideoDownloadProof = z.infer<typeof VideoDownloadProofSchema>;
export type VideoDownloadResult = z.infer<typeof VideoDownloadResultSchema>;
