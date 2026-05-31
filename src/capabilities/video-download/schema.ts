import { z } from "zod";

export const VIDEO_DOWNLOAD_ABILITY_GROUP_ID = "video-download" as const;

const VideoDownloadPlatformIdSchema = z.enum([
  "universal-web",
  "facebook-web",
  "tiktok-web",
  "instagram-web",
  "bilibili-web",
  "douyin-web",
  "x-web",
  "xiaohongshu-web",
  "youtube-web",
  "telegram-web",
]);

const VideoDownloadChildCapabilityIdSchema = z.enum([
  "download-web-video-once",
  "download-facebook-video-once",
  "download-tiktok-video-once",
  "download-instagram-video-once",
  "download-bilibili-video-once",
  "download-douyin-video-once",
  "download-x-video-once",
  "download-xiaohongshu-video-once",
  "download-youtube-video-once",
  "download-telegram-web-video-once",
]);

const VideoDownloadPreferredQualitySchema = z.enum([
  "2160p",
  "1440p",
  "1080p",
  "720p",
  "480p",
  "360p",
  "hd",
  "sd",
  "best_available",
]);

const VideoDownloadPublicPlatformSchema = z.enum([
  "universal",
  "facebook",
  "tiktok",
  "instagram",
  "bilibili",
  "douyin",
  "x",
  "xiaohongshu",
  "youtube",
  "telegram-web",
]);

const VideoDownloadArtifactPolicySchema = z.enum(["deliverable", "staging"]);

const VideoArtifactDispositionSchema = z.enum(["staging", "final"]);

const VideoDownloadStatusSchema = z.enum([
  "success",
  "failed",
  "review_required",
  "invalid_input",
]);

const VideoDownloadFailureReasonSchema = z.enum([
  "input_schema_invalid",
  "unknown_child_capability",
  "source_page_mismatch",
  "candidate_not_found",
  "candidate_not_video",
  "candidate_host_forbidden",
  "download_expired",
  "download_too_large",
  "downloaded_file_invalid",
  "login_required",
  "captcha_or_2fa_required",
  "drm_or_private_video",
  "permission_denied",
  "network_failed",
  "metadata_validation_failed",
  "artifact_write_failed",
]);

const VideoDownloadSubtitleArtifactSchema = z.object({
  artifactRef: z.string().min(1),
  storageRef: z.string().min(1),
  filePath: z.string().min(1),
  sha256: z.string().min(64).max(64),
  language: z.string().min(1),
  contentType: z.string().min(1),
  byteSize: z.number().int().positive(),
  sourceKind: z.enum(["manual", "automatic"]),
}).strict();

const VideoDownloadCandidateKindSchema = z.enum([
  "native_hd",
  "native_sd",
  "video_element",
  "source_element",
  "media_resource",
  "hls_manifest",
  "dash_manifest",
  "telegram_sw_progressive_cache",
  "telegram_sw_download_stream",
]);

const VideoDownloadCandidateSchema = z.object({
  kind: VideoDownloadCandidateKindSchema,
  url: z.string().url(),
  source: z.string().min(1),
  quality: z.enum(["hd", "sd", "unknown"]),
}).strict();

export const VideoDownloadPublicRequestSchema = z.object({
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  roundId: z.string().min(1).optional(),
  sourcePageUrl: z.string().url(),
  platform: VideoDownloadPublicPlatformSchema.default("universal"),
  preferredQuality: VideoDownloadPreferredQualitySchema.default("best_available"),
  maxBytes: z.number().int().min(1024).max(Number.MAX_SAFE_INTEGER).default(5_000_000_000),
  timeoutMs: z.number().int().min(1000).max(86_400_000).default(3_600_000),
  artifactPolicy: VideoDownloadArtifactPolicySchema.default("deliverable"),
  downloadSubtitles: z.boolean().default(false),
  subtitleLanguages: z.array(z.string().min(1)).max(8).default(["en"]),
  telegramDocumentIdHash: z.string().regex(/^[a-f0-9]{24}$/u).optional(),
}).strict();

// ─── Shared input base ────────────────────────────────────────────────────────

const VideoDownloadInputBaseSchema = z.object({
  abilityGroupId: z.literal(VIDEO_DOWNLOAD_ABILITY_GROUP_ID).default(VIDEO_DOWNLOAD_ABILITY_GROUP_ID),
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  roundId: z.string().min(1).optional(),
  capabilityCallId: z.string().min(1),
  sourcePageUrl: z.string().url(),
  preferredQuality: VideoDownloadPreferredQualitySchema.default("best_available"),
  maxBytes: z.number().int().min(1024).max(Number.MAX_SAFE_INTEGER).default(5_000_000_000),
  timeoutMs: z.number().int().min(1000).max(86_400_000).default(3_600_000),
  artifactDisposition: VideoArtifactDispositionSchema.default("final"),
  downloadSubtitles: z.boolean().default(false),
  subtitleLanguages: z.array(z.string().min(1)).max(8).default(["en"]),
});

// ─── Per-child input schemas ──────────────────────────────────────────────────

const DownloadWebVideoInputSchema = VideoDownloadInputBaseSchema.extend({
  childCapabilityId: z.literal("download-web-video-once"),
}).strict();

const DownloadFacebookVideoInputSchema = VideoDownloadInputBaseSchema.extend({
  childCapabilityId: z.literal("download-facebook-video-once"),
}).strict();

const DownloadTikTokVideoInputSchema = VideoDownloadInputBaseSchema.extend({
  childCapabilityId: z.literal("download-tiktok-video-once"),
}).strict();

const DownloadInstagramVideoInputSchema = VideoDownloadInputBaseSchema.extend({
  childCapabilityId: z.literal("download-instagram-video-once"),
}).strict();

const DownloadBilibiliVideoInputSchema = VideoDownloadInputBaseSchema.extend({
  childCapabilityId: z.literal("download-bilibili-video-once"),
}).strict();

const DownloadDouyinVideoInputSchema = VideoDownloadInputBaseSchema.extend({
  childCapabilityId: z.literal("download-douyin-video-once"),
}).strict();

const DownloadXVideoInputSchema = VideoDownloadInputBaseSchema.extend({
  childCapabilityId: z.literal("download-x-video-once"),
}).strict();

const DownloadXiaohongshuVideoInputSchema = VideoDownloadInputBaseSchema.extend({
  childCapabilityId: z.literal("download-xiaohongshu-video-once"),
}).strict();

const DownloadYoutubeVideoInputSchema = VideoDownloadInputBaseSchema.extend({
  childCapabilityId: z.literal("download-youtube-video-once"),
}).strict();

const DownloadTelegramWebVideoInputSchema = VideoDownloadInputBaseSchema.extend({
  childCapabilityId: z.literal("download-telegram-web-video-once"),
  telegramDocumentIdHash: z.string().regex(/^[a-f0-9]{24}$/u).optional(),
}).strict();

export const VideoDownloadAbilityInputSchema = z.discriminatedUnion("childCapabilityId", [
  DownloadWebVideoInputSchema,
  DownloadFacebookVideoInputSchema,
  DownloadTikTokVideoInputSchema,
  DownloadInstagramVideoInputSchema,
  DownloadBilibiliVideoInputSchema,
  DownloadDouyinVideoInputSchema,
  DownloadXVideoInputSchema,
  DownloadXiaohongshuVideoInputSchema,
  DownloadYoutubeVideoInputSchema,
  DownloadTelegramWebVideoInputSchema,
]);

// ─── Proof + artifact ────────────────────────────────────────────────────────

const VideoDownloadArtifactSchema = z.object({
  artifactRef: z.string().min(1),
  storageRef: z.string().min(1),
  filePath: z.string().min(1),
  sha256: z.string().min(64).max(64),
  artifactDisposition: VideoArtifactDispositionSchema,
}).strict();

const VideoDownloadProofSchema = z.object({
  proofId: z.string().min(1),
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1).nullable(),
  roundId: z.string().min(1).nullable(),
  capabilityCallId: z.string().min(1),
  abilityGroupId: z.literal(VIDEO_DOWNLOAD_ABILITY_GROUP_ID),
  childCapabilityId: VideoDownloadChildCapabilityIdSchema,
  sourcePageUrl: z.string().url(),
  platformId: VideoDownloadPlatformIdSchema,
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
  selectedQuality: z.union([VideoDownloadPreferredQualitySchema, z.literal("unknown")]),
  artifactRef: z.string().min(1).nullable(),
  artifactDisposition: VideoArtifactDispositionSchema.nullable(),
  sha256: z.string().min(64).max(64).nullable(),
  subtitleArtifacts: z.array(VideoDownloadSubtitleArtifactSchema).default([]),
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  durationMsTotal: z.number().nonnegative(),
}).strict();

const VideoDownloadSuccessOutputSchema = z.object({
  status: z.literal("success"),
  platformId: VideoDownloadPlatformIdSchema,
  sourcePageUrl: z.string().url(),
  videoId: z.string().min(1).nullable(),
  artifactRef: z.string().min(1),
  storageRef: z.string().min(1),
  filePath: z.string().min(1),
  sha256: z.string().min(64).max(64),
  artifactDisposition: VideoArtifactDispositionSchema,
  contentType: z.string().min(1),
  byteSize: z.number().int().positive(),
  durationMs: z.number().nonnegative().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  selectedQuality: z.union([VideoDownloadPreferredQualitySchema, z.literal("unknown")]),
  candidateKind: VideoDownloadCandidateKindSchema,
  downloadedAt: z.string().min(1),
  proofRef: z.string().min(1),
  subtitleArtifacts: z.array(VideoDownloadSubtitleArtifactSchema),
}).strict();

const VideoDownloadFailureOutputSchema = z.object({
  status: z.enum(["failed", "review_required", "invalid_input"]),
  platformId: VideoDownloadPlatformIdSchema,
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
export type VideoDownloadCandidate = z.infer<typeof VideoDownloadCandidateSchema>;
export type VideoDownloadArtifact = z.infer<typeof VideoDownloadArtifactSchema>;
export type VideoDownloadAbilityInput = z.input<typeof VideoDownloadAbilityInputSchema>;
export type ParsedVideoDownloadAbilityInput = z.output<typeof VideoDownloadAbilityInputSchema>;
export type VideoDownloadPublicPlatform = z.infer<typeof VideoDownloadPublicPlatformSchema>;
export type VideoDownloadPublicRequest = z.input<typeof VideoDownloadPublicRequestSchema>;
export type VideoDownloadResult = z.infer<typeof VideoDownloadResultSchema>;
