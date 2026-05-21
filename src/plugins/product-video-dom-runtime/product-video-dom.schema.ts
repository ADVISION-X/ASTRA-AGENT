import { z } from "zod";

export const ProductVideoAiDecisionSchema = z.enum([
  "product_seed",
  "not_product_seed",
  "review_required",
]);

export const ProductVideoDomTaskStatusSchema = z.enum([
  "received",
  "running",
  "liked",
  "comments_recorded",
  "advanced_to_next_video",
  "not_product_seed",
  "login_required",
  "captcha_or_2fa_required",
  "review_required",
  "failed",
]);

export const ProductVideoDomMissionInputSchema = z.object({
  missionType: z.literal("product_video_dom_mining"),
  platformId: z.string().min(1).max(80),
  pageUrl: z.string().url(),
  videoVisitId: z.string().min(1).max(120),
  aiDecision: ProductVideoAiDecisionSchema.optional(),
  aiDecisionReason: z.string().min(1).max(500).optional(),
  targetHints: z.object({
    likeButton: z.array(z.string().min(1)).min(1),
    commentsButton: z.array(z.string().min(1)).min(1),
    nextVideoButton: z.array(z.string().min(1)).min(1),
  }).strict(),
}).strict();

export const ProductVideoEngagementSchema = z.object({
  likesText: z.string().optional(),
  commentsText: z.string().optional(),
  savesText: z.string().optional(),
  sharesText: z.string().optional(),
}).strict();

export const ProductVideoCommentSchema = z.object({
  commentId: z.string().min(1),
  authorText: z.string().optional(),
  commentText: z.string().min(1),
}).strict();

export const ProductVideoCommentDetailSchema = z.object({
  text: z.string().min(1),
  authorText: z.string().min(1).nullable().optional().default(null),
  likesText: z.string().min(1).nullable().optional().default(null),
  capturedAt: z.string().datetime(),
}).strict();

export const ProductVideoJudgeInputSchema = z.object({
  schemaVersion: z.literal("productVideoJudge.input.v1"),
  platformId: z.string().min(1).max(80),
  pageUrl: z.string().url(),
  videoVisitId: z.string().min(1).max(120).nullable(),
  pageTitle: z.string().min(1).nullable(),
  titleText: z.string().min(1).nullable(),
  descriptionText: z.string().min(1).nullable(),
  authorText: z.string().min(1).nullable(),
  hashtags: z.array(z.string().min(1)).max(50),
  likesText: z.string().min(1).nullable(),
  commentsText: z.string().min(1).nullable(),
  sharesText: z.string().min(1).nullable(),
  productLinkVisible: z.boolean(),
  shopEntryVisible: z.boolean(),
  externalLinkVisible: z.boolean(),
  visibleTextSample: z.array(z.string().min(1)).max(60),
  sampledComments: z.array(z.string().min(1)).max(50),
  screenshotRef: z.string().min(1).nullable().optional().default(null),
  userRequirementText: z.string().min(1),
}).strict();

export const ProductVideoJudgeOutputSchema = z.object({
  schemaVersion: z.literal("productVideoJudge.v1"),
  isProductSeedingVideo: z.boolean(),
  confidence: z.number().min(0).max(1),
  productCategoryHint: z.string().min(1).nullable(),
  productNameHint: z.string().min(1).nullable(),
  productEvidence: z.array(z.string().min(1)).max(12),
  seedingEvidence: z.array(z.string().min(1)).max(12),
  commentEvidence: z.array(z.string().min(1)).max(12),
  rejectReason: z.string().min(1).nullable(),
  shouldSave: z.boolean(),
  shouldCollectComments: z.boolean(),
  shouldVisualVerify: z.boolean(),
  nextDomAction: z.enum(["collect_evidence", "next_video", "review_required"]),
}).strict().superRefine((value, ctx) => {
  if (value.isProductSeedingVideo && !value.shouldSave) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Product-seeding videos must set shouldSave=true.",
      path: ["shouldSave"],
    });
  }
  if (value.nextDomAction === "collect_evidence" && !value.shouldSave) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "collect_evidence requires shouldSave=true.",
      path: ["shouldSave"],
    });
  }
  if (value.nextDomAction === "next_video" && value.shouldSave) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "next_video requires shouldSave=false.",
      path: ["shouldSave"],
    });
  }
  if (
    value.nextDomAction === "review_required"
    && !value.rejectReason
    && value.productEvidence.length === 0
    && value.seedingEvidence.length === 0
    && value.commentEvidence.length === 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "review_required requires rejectReason or evidence.",
      path: ["rejectReason"],
    });
  }
});

export const ProductVideoDomRoundResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("continue"),
    reason: z.string().min(1),
    videoVisitId: z.string().min(1).nullable().optional().default(null),
  }).strict(),
  z.object({
    status: z.literal("review_required"),
    reason: z.string().min(1),
  }).strict(),
  z.object({
    status: z.literal("stop"),
    reason: z.string().min(1),
  }).strict(),
]);

export const ProductVideoBrowseLedgerEntrySchema = z.object({
  missionId: z.string().min(1),
  roundId: z.string().min(1),
  pageUrlBefore: z.string().url(),
  pageUrlAfter: z.string().url().nullable(),
  videoVisitIdBefore: z.string().min(1).nullable(),
  videoVisitIdAfter: z.string().min(1).nullable(),
  action: z.enum(["click_next", "scroll_next", "keyboard_next", "skip_no_change"]),
  status: z.enum(["success", "failed"]),
  reason: z.string().min(1),
  createdAt: z.string().datetime(),
}).strict();

export const ProductVideoCommentFetchStatusSchema = z.enum([
  "not_requested",
  "success",
  "partial",
  "failed",
]);

export const ProductVideoScreenshotStatusSchema = z.enum([
  "success",
  "failed",
]);

export const ProductVideoEvidenceRecordSchema = z.object({
  id: z.string().min(1),
  missionId: z.string().min(1),
  runId: z.string().min(1),
  roundId: z.string().min(1),
  platformId: z.string().min(1),
  pageUrl: z.string().url(),
  videoVisitId: z.string().min(1).nullable(),
  capturedAt: z.string().datetime(),
  screenshotStatus: ProductVideoScreenshotStatusSchema,
  screenshotRef: z.string().min(1).nullable(),
  screenshotPath: z.string().min(1).nullable(),
  titleText: z.string().min(1).nullable(),
  descriptionText: z.string().min(1).nullable(),
  authorText: z.string().min(1).nullable(),
  hashtags: z.array(z.string().min(1)).max(50),
  likesText: z.string().min(1).nullable(),
  likesCount: z.number().int().nonnegative().nullable(),
  commentsText: z.string().min(1).nullable(),
  commentsCount: z.number().int().nonnegative().nullable(),
  sharesText: z.string().min(1).nullable(),
  sharesCount: z.number().int().nonnegative().nullable(),
  productLinkVisible: z.boolean(),
  shopEntryVisible: z.boolean(),
  externalLinkVisible: z.boolean(),
  commentFetchStatus: ProductVideoCommentFetchStatusSchema,
  commentDetails: z.array(ProductVideoCommentDetailSchema).max(200),
  aiJudge: ProductVideoJudgeOutputSchema,
  rawDomEvidenceRef: z.string().min(1).nullable(),
  evidenceRefs: z.array(z.string().min(1)).max(80),
}).strict();

export const ProductVideoEvidencePacketSchema = z.object({
  platformId: z.string().min(1),
  pageUrl: z.string().url(),
  videoVisitId: z.string().min(1),
  videoDomId: z.string().min(1),
  author: z.string().optional(),
  titleText: z.string().optional(),
  descriptionText: z.string().optional(),
  hashtags: z.array(z.string()),
  engagement: ProductVideoEngagementSchema,
  productSignals: z.array(z.string()),
  commentCountText: z.string().optional(),
  comments: z.array(ProductVideoCommentSchema),
  aiDecision: ProductVideoAiDecisionSchema,
  aiDecisionReason: z.string().optional(),
  liked: z.boolean(),
  nextActionHint: z.literal("next-video"),
  evidenceRefs: z.array(z.string().min(1)),
  capturedAt: z.string().datetime(),
}).strict();

export const ProductVideoDomTaskRecordSchema = z.object({
  taskId: z.string().min(1),
  mission: ProductVideoDomMissionInputSchema,
  status: ProductVideoDomTaskStatusSchema,
  ok: z.boolean(),
  reason: z.string().min(1),
  reachedStep: z.string().min(1),
  evidencePacketPath: z.string().optional(),
  evidenceRefs: z.array(z.string().min(1)),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

export type ProductVideoAiDecision = z.infer<typeof ProductVideoAiDecisionSchema>;
export type ProductVideoDomTaskStatus = z.infer<typeof ProductVideoDomTaskStatusSchema>;
export type ProductVideoDomMissionInput = z.infer<typeof ProductVideoDomMissionInputSchema>;
export type ProductVideoEngagement = z.infer<typeof ProductVideoEngagementSchema>;
export type ProductVideoComment = z.infer<typeof ProductVideoCommentSchema>;
export type ProductVideoCommentDetail = z.infer<typeof ProductVideoCommentDetailSchema>;
export type ProductVideoJudgeInput = z.infer<typeof ProductVideoJudgeInputSchema>;
export type ProductVideoJudgeOutput = z.infer<typeof ProductVideoJudgeOutputSchema>;
export type ProductVideoDomRoundResult = z.infer<typeof ProductVideoDomRoundResultSchema>;
export type ProductVideoBrowseLedgerEntry = z.infer<typeof ProductVideoBrowseLedgerEntrySchema>;
export type ProductVideoCommentFetchStatus = z.infer<typeof ProductVideoCommentFetchStatusSchema>;
export type ProductVideoScreenshotStatus = z.infer<typeof ProductVideoScreenshotStatusSchema>;
export type ProductVideoEvidencePacket = z.infer<typeof ProductVideoEvidencePacketSchema>;
export type ProductVideoEvidenceRecord = z.infer<typeof ProductVideoEvidenceRecordSchema>;
export type ProductVideoDomTaskRecord = z.infer<typeof ProductVideoDomTaskRecordSchema>;
