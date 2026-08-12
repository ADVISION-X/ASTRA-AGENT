import { z } from "zod";

const FacebookProviderKindSchema = z.enum(["gpt-web-chat", "gemini-web-chat"]);
const DEFAULT_FACEBOOK_MINING_FEED_ENTRY_URL = "https://www.facebook.com/reels/";
const DEFAULT_FACEBOOK_MINING_PROVIDER_KIND = "gpt-web-chat";
const DEFAULT_FACEBOOK_MINING_MAX_MINUTES = 20;
const FACEBOOK_MINING_ROUNDS_PER_TARGET = 4;

const FacebookMiningStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "max_rounds_reached",
  "max_minutes_reached",
  "review_required",
  "failed",
]);

const FacebookRoundStatusSchema = z.enum([
  "running",
  "saved",
  "rejected",
  "uncertain",
  "review_required",
  "failed",
]);

const FacebookSelectorEvidenceSchema = z.object({
  selector: z.string().min(1).nullable().default(null),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  matchedSignals: z.array(z.string().min(1)).default([]),
  visibleText: z.string().nullable().default(null),
}).strict();

const FacebookVideoElementFactSchema = z.object({
  src: z.string().nullable().default(null),
  currentSrc: z.string().nullable().default(null),
  duration: z.number().nonnegative().nullable().default(null),
  width: z.number().int().nonnegative().nullable().default(null),
  height: z.number().int().nonnegative().nullable().default(null),
  readyState: z.number().int().nonnegative().nullable().default(null),
  muted: z.boolean().default(false),
  paused: z.boolean().default(true),
}).strict();

const FacebookDomSignalsSummarySchema = z.object({
  matchedTexts: z.array(z.string().min(1)).default([]),
  blockerReasons: z.array(z.string().min(1)).default([]),
  candidateCounts: z.array(z.object({
    kind: z.string().min(1),
    count: z.number().int().nonnegative(),
  }).strict()).default([]),
}).strict();

const validateMissionRoundLimit = (
  value: { maxRounds: number; targetProductCount: number },
  context: z.RefinementCtx,
): void => {
  if (value.maxRounds < value.targetProductCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "maxRounds must be greater than or equal to targetProductCount.",
      path: ["maxRounds"],
    });
  }
};

const FacebookFeedEntryUrlSchema = z.string().url().refine((value) => {
  const host = new URL(value).host.toLowerCase();
  return host === "facebook.com" || host === "www.facebook.com" || host === "m.facebook.com";
}, "feedEntryUrl must target facebook.com.");

const FacebookProductVideoMiningResolvedMissionConfigObjectSchema = z.object({
  missionId: z.string().min(1).optional(),
  feedEntryUrl: FacebookFeedEntryUrlSchema,
  providerKind: FacebookProviderKindSchema,
  modelName: z.string().min(1).nullable(),
  targetProductCount: z.number().int().positive(),
  maxRounds: z.number().int().positive(),
  maxMinutes: z.number().int().positive(),
  maxCommentScrolls: z.number().int().positive().default(80),
  maxCommentWaitMs: z.number().int().positive().default(12_000),
  preferredQuality: z.enum(["hd", "sd", "best_available"]).default("best_available"),
  maxVideoBytes: z.number().int().min(1_024).max(500_000_000).default(200_000_000),
  notInterestedEnabled: z.boolean().default(false),
  saveRejectedTrace: z.boolean().default(true),
}).strict();

const FacebookProductVideoMiningResolvedMissionConfigSchema =
  FacebookProductVideoMiningResolvedMissionConfigObjectSchema.superRefine(validateMissionRoundLimit);

const FacebookProductVideoMiningRawMissionInputSchema = z.object({
  missionId: z.string().min(1).optional(),
  feedEntryUrl: FacebookFeedEntryUrlSchema.default(DEFAULT_FACEBOOK_MINING_FEED_ENTRY_URL),
  providerKind: FacebookProviderKindSchema.default(DEFAULT_FACEBOOK_MINING_PROVIDER_KIND),
  modelName: z.string().min(1).nullable().optional(),
  targetProductCount: z.number().int().positive(),
  maxRounds: z.number().int().positive().optional(),
  maxMinutes: z.number().int().positive().default(DEFAULT_FACEBOOK_MINING_MAX_MINUTES),
  maxCommentScrolls: z.number().int().positive().default(80),
  maxCommentWaitMs: z.number().int().positive().default(12_000),
  preferredQuality: z.enum(["hd", "sd", "best_available"]).default("best_available"),
  maxVideoBytes: z.number().int().min(1_024).max(500_000_000).default(200_000_000),
  notInterestedEnabled: z.boolean().default(false),
  saveRejectedTrace: z.boolean().default(true),
}).strict().transform((value) => ({
  ...value,
  modelName: value.modelName ?? null,
  maxRounds: value.maxRounds ?? Math.max(value.targetProductCount, value.targetProductCount * FACEBOOK_MINING_ROUNDS_PER_TARGET),
}));

export const FacebookProductVideoMiningMissionInputSchema =
  FacebookProductVideoMiningRawMissionInputSchema.pipe(FacebookProductVideoMiningResolvedMissionConfigSchema);

const FacebookProductVideoMiningRunConfigSchema = FacebookProductVideoMiningResolvedMissionConfigObjectSchema.extend({
  missionId: z.string().min(1),
  runId: z.string().min(1),
  startedAt: z.string().datetime(),
}).strict().superRefine(validateMissionRoundLimit);

const FacebookProductVideoMiningRoundStateSchema = z.object({
  missionId: z.string().min(1),
  runId: z.string().min(1),
  roundId: z.string().min(1),
  roundIndex: z.number().int().nonnegative(),
  status: FacebookRoundStatusSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable().default(null),
  sourcePageUrl: z.string().nullable().default(null),
  candidateId: z.string().nullable().default(null),
  reason: z.string().nullable().default(null),
}).strict();

const FacebookVideoDomProbeResultSchema = z.object({
  status: z.enum(["success", "login_required", "captcha_or_2fa_required", "review_required", "failed"]),
  sourcePageUrl: z.string().min(1),
  pageTitle: z.string().min(1),
  facebookVideoId: z.string().nullable().default(null),
  videoElementFacts: z.array(FacebookVideoElementFactSchema),
  primaryVideoFact: FacebookVideoElementFactSchema.nullable().default(null),
  likeCount: z.number().int().nonnegative().nullable().default(null),
  commentCountDisplayed: z.number().int().nonnegative().nullable().default(null),
  shareCountDisplayed: z.number().int().nonnegative().nullable().default(null),
  authorText: z.string().nullable().default(null),
  captionText: z.string().nullable().default(null),
  commentEntryElementRef: FacebookSelectorEvidenceSchema.nullable().default(null),
  moreMenuElementRef: FacebookSelectorEvidenceSchema.nullable().default(null),
  notInterestedElementRef: FacebookSelectorEvidenceSchema.nullable().default(null),
  nextVideoElementRef: FacebookSelectorEvidenceSchema.nullable().default(null),
  likeCountElementRef: FacebookSelectorEvidenceSchema.nullable().default(null),
  commentCountElementRef: FacebookSelectorEvidenceSchema.nullable().default(null),
  rawDomSignalsSummary: FacebookDomSignalsSummarySchema,
  blocker: z.string().nullable().default(null),
  capturedAt: z.string().datetime(),
}).strict();

const FacebookCommentRecordSchema = z.object({
  commentId: z.string().nullable().default(null),
  authorDisplayText: z.string().nullable().default(null),
  commentText: z.string().min(1),
  likeCount: z.number().int().nonnegative().nullable().default(null),
  replyDepth: z.number().int().nonnegative().default(0),
  parentCommentId: z.string().nullable().default(null),
  ordinal: z.number().int().nonnegative(),
  capturedAt: z.string().datetime(),
  sourceSignal: z.string().min(1),
}).strict();

const FacebookAiProviderProofSchema = z.object({
  providerKind: FacebookProviderKindSchema,
  webChatUrl: z.string().nullable().default(null),
  sourcePageUrlBeforeFeed: z.string().nullable().default(null),
  restoredSourcePage: z.boolean().nullable().default(null),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  inputHash: z.string().min(1),
  outputHash: z.string().nullable().default(null),
}).strict();

const FacebookVideoAiJudgmentSchema = z.object({
  providerKind: FacebookProviderKindSchema,
  status: z.enum(["success", "review_required", "failed"]),
  selectedOptionId: z.enum(["PRODUCT_SEEDING", "NOT_PRODUCT_SEEDING", "UNCERTAIN"]),
  confidence: z.number().min(0).max(1),
  visibleProduct: z.string().nullable().default(null),
  productCategory: z.string().nullable().default(null),
  sellingIntentSignals: z.array(z.string().min(1)).default([]),
  evidenceFromVideo: z.array(z.string().min(1)).default([]),
  reason: z.string().min(1),
  rawOutputRef: z.string().nullable().default(null),
  rawOutputHash: z.string().nullable().default(null),
  normalizedText: z.string().nullable().default(null),
  parseStatus: z.enum(["json_valid", "json_invalid", "not_requested"]),
  schemaValidationStatus: z.enum(["valid", "invalid", "not_applicable"]),
  providerProof: FacebookAiProviderProofSchema,
  createdAt: z.string().datetime(),
}).strict();

const FacebookProductVideoCandidateRecordSchema = z.object({
  id: z.string().min(1),
  missionId: z.string().min(1),
  runId: z.string().min(1),
  roundId: z.string().min(1),
  roundIndex: z.number().int().nonnegative(),
  sourcePageUrl: z.string().min(1),
  facebookVideoId: z.string().nullable().default(null),
  pageTitle: z.string().nullable().default(null),
  authorText: z.string().nullable().default(null),
  captionText: z.string().nullable().default(null),
  likeCount: z.number().int().nonnegative().nullable().default(null),
  commentCountDisplayed: z.number().int().nonnegative().nullable().default(null),
  commentsLoadedCount: z.number().int().nonnegative().default(0),
  commentsComplete: z.boolean().default(false),
  commentStopReason: z.string().nullable().default(null),
  aiSelectedOptionId: z.enum(["PRODUCT_SEEDING", "NOT_PRODUCT_SEEDING", "UNCERTAIN"]).nullable().default(null),
  aiConfidence: z.number().min(0).max(1).nullable().default(null),
  aiReason: z.string().nullable().default(null),
  videoArtifactRef: z.string().nullable().default(null),
  videoFilePath: z.string().nullable().default(null),
  videoSha256: z.string().nullable().default(null),
  videoByteSize: z.number().int().nonnegative().nullable().default(null),
  videoContentType: z.string().nullable().default(null),
  videoArtifactDisposition: z.enum(["staging", "final"]).nullable().default(null),
  status: FacebookRoundStatusSchema,
  notInterestedStatus: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable().default(null),
}).strict();

const FacebookProductVideoMiningRunStatusSchema = z.object({
  runId: z.string().min(1),
  missionId: z.string().min(1),
  feedEntryUrl: z.string().url(),
  providerKind: FacebookProviderKindSchema,
  targetProductCount: z.number().int().positive(),
  maxRounds: z.number().int().positive(),
  status: FacebookMiningStatusSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable().default(null),
  failureReason: z.string().nullable().default(null),
  videoArtifactRef: z.string().nullable().default(null),
  savedProductCount: z.number().int().nonnegative(),
  scannedCount: z.number().int().nonnegative(),
  currentRoundId: z.string().nullable().default(null),
  currentRoundIndex: z.number().int().nonnegative().nullable().default(null),
}).strict();

const FacebookProductVideoMiningSelectionExportItemSchema = z.object({
  candidateId: z.string().min(1),
  runId: z.string().min(1),
  rank: z.number().int().positive(),
  sourcePageUrl: z.string().min(1),
  facebookVideoId: z.string().nullable(),
  pageTitle: z.string().nullable(),
  authorText: z.string().nullable(),
  captionText: z.string().nullable(),
  likeCount: z.number().int().nonnegative().nullable(),
  commentCountDisplayed: z.number().int().nonnegative().nullable(),
  commentsLoadedCount: z.number().int().nonnegative(),
  aiConfidence: z.number().min(0).max(1).nullable(),
  aiReason: z.string().nullable(),
  visibleProduct: z.string().nullable(),
  productCategory: z.string().nullable(),
  sellingIntentSignals: z.array(z.string().min(1)),
  evidenceFromVideo: z.array(z.string().min(1)),
  videoArtifactRef: z.string().nullable(),
  videoFilePath: z.string().nullable(),
  videoSha256: z.string().nullable(),
  createdAt: z.string().datetime(),
}).strict();

const FacebookProductVideoMiningSelectionExportSchema = z.object({
  exportKind: z.literal("facebook-product-video-mining.selection.v1"),
  exportedAt: z.string().datetime(),
  run: FacebookProductVideoMiningRunStatusSchema,
  savedProductCount: z.number().int().nonnegative(),
  targetProductCount: z.number().int().positive(),
  records: z.array(FacebookProductVideoMiningSelectionExportItemSchema),
}).strict();

export const FacebookProductVideoMiningSchemas = {
  FacebookProductVideoMiningMissionInputSchema,
  FacebookProductVideoMiningRunConfigSchema,
  FacebookProductVideoMiningRoundStateSchema,
  FacebookVideoDomProbeResultSchema,
  FacebookCommentRecordSchema,
  FacebookVideoAiJudgmentSchema,
  FacebookProductVideoCandidateRecordSchema,
  FacebookProductVideoMiningRunStatusSchema,
  FacebookProductVideoMiningSelectionExportItemSchema,
  FacebookProductVideoMiningSelectionExportSchema,
} as const;

export type FacebookProductVideoMiningContracts = {
  FacebookProductVideoMiningMissionInput: z.infer<typeof FacebookProductVideoMiningMissionInputSchema>;
  FacebookProductVideoMiningRunConfig: z.infer<typeof FacebookProductVideoMiningRunConfigSchema>;
  FacebookProductVideoMiningRoundState: z.infer<typeof FacebookProductVideoMiningRoundStateSchema>;
  FacebookVideoDomProbeResult: z.infer<typeof FacebookVideoDomProbeResultSchema>;
  FacebookCommentRecord: z.infer<typeof FacebookCommentRecordSchema>;
  FacebookVideoAiJudgment: z.infer<typeof FacebookVideoAiJudgmentSchema>;
  FacebookProductVideoCandidateRecord: z.infer<typeof FacebookProductVideoCandidateRecordSchema>;
  FacebookMiningStatus: z.infer<typeof FacebookMiningStatusSchema>;
  FacebookProductVideoMiningRunStatus: z.infer<typeof FacebookProductVideoMiningRunStatusSchema>;
  FacebookProductVideoMiningSelectionExportItem: z.infer<typeof FacebookProductVideoMiningSelectionExportItemSchema>;
  FacebookProductVideoMiningSelectionExport: z.infer<typeof FacebookProductVideoMiningSelectionExportSchema>;
  FacebookSelectorEvidence: z.infer<typeof FacebookSelectorEvidenceSchema>;
};
