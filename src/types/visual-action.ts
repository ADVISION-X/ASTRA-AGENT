import { z } from "zod";

export const VisualTargetTypeSchema = z.enum([
  "video_area",
  "current_video_content",
  "like_button",
  "save_button",
  "comments_button",
  "comments_panel",
  "close_comments_button",
  "not_interested_button",
  "next_video_region",
  "scroll_area",
  "login_wall",
  "captcha_challenge",
  "safety_page",
  "unknown_ui",
  "metric_like_count",
  "metric_comment_count",
  "metric_share_count",
  "metric_save_count",
]);

export const VisualBoundingBoxSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const VisualClickPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const VisualTargetSchema = z.object({
  targetId: z.string().min(1),
  targetType: VisualTargetTypeSchema,
  sourceScreenshotEvidenceId: z.string().min(1),
  boundingBox: VisualBoundingBoxSchema,
  clickPoint: VisualClickPointSchema,
  confidence: z.number().min(0).max(1),
  detectionMethod: z.string().min(1),
  visibleText: z.string().min(1).nullable().default(null),
  uncertainty: z.array(z.string().min(1)).default([]),
  blockedReason: z.string().min(1).nullable().default(null),
  createdAt: z.string().datetime(),
});

export const VisualActionVerificationResultSchema = z.object({
  verified: z.boolean(),
  verificationMethod: z.string().min(1),
  expectedChange: z.string().min(1),
  observedChange: z.string().min(1),
  confidence: z.number().min(0).max(1),
  failureReason: z.string().min(1).nullable().default(null),
});

export const VisualActionRequestSchema = z.object({
  actionType: z.string().min(1),
  actionPurpose: z.string().min(1),
  targetType: VisualTargetTypeSchema,
  target: VisualTargetSchema,
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1).nullable().default(null),
  beforeEvidenceId: z.string().min(1).nullable().default(null),
});

export const VisualActionResultSchema = z.object({
  actionLogId: z.string().min(1),
  result: z.enum(["success", "failed", "skipped", "review_required"]),
  afterEvidenceId: z.string().min(1).nullable().default(null),
  verificationResult: VisualActionVerificationResultSchema,
  failureReason: z.string().min(1).nullable().default(null),
  createdAt: z.string().datetime(),
});

export const VisualTargetCatalogSchema = z.object({
  targetType: VisualTargetTypeSchema,
  purpose: z.string().min(1),
  allowedActions: z.array(z.string().min(1)).min(1),
  requiredConfidence: z.number().min(0).max(1),
  requiredEvidence: z.string().min(1),
  failureBehavior: z.string().min(1),
});

export type VisualTargetType = z.infer<typeof VisualTargetTypeSchema>;
export type VisualBoundingBox = z.infer<typeof VisualBoundingBoxSchema>;
export type VisualClickPoint = z.infer<typeof VisualClickPointSchema>;
export type VisualTarget = z.infer<typeof VisualTargetSchema>;
export type VisualActionRequest = z.infer<typeof VisualActionRequestSchema>;
export type VisualActionResult = z.infer<typeof VisualActionResultSchema>;
export type VisualActionVerificationResult = z.infer<typeof VisualActionVerificationResultSchema>;
export type VisualTargetCatalog = z.infer<typeof VisualTargetCatalogSchema>;