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
export type ProductVideoEvidencePacket = z.infer<typeof ProductVideoEvidencePacketSchema>;
export type ProductVideoDomTaskRecord = z.infer<typeof ProductVideoDomTaskRecordSchema>;
