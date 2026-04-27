import { z } from "zod";

import { EvidenceRefSchema } from "./evidence.js";
import {
  EvidencePacketActionPurposeSchema,
  EvidencePacketActionTriggerSourceSchema,
} from "./evidence-packet.js";
import {
  VisualActionResultSchema,
  VisualBoundingBoxSchema,
  VisualTargetSchema,
  VisualTargetTypeSchema,
} from "./visual-action.js";

export const PlatformActionTypeSchema = z.enum([
  "open_feed",
  "observe_current_video",
  "capture_video_region",
  "click_not_interested",
  "like_or_save_candidate",
  "open_comments",
  "capture_comment_region",
  "continue_next",
  "scroll",
  "wait",
  "close"
]);

export const PlatformActionRequestSchema = z.object({
  actionId: z.string().min(1),
  taskRunId: z.string().min(1),
  roundId: z.string().min(1),
  platformId: z.string().min(1),
  type: PlatformActionTypeSchema,
  target: z.string().min(1),
  requestedAt: z.string().datetime(),
  reason: z.string().min(1),
  evidenceRefs: z.array(EvidenceRefSchema).default([])
});

export const PlatformActionResultSchema = z.object({
  actionId: z.string().min(1),
  platformId: z.string().min(1),
  type: PlatformActionTypeSchema,
  status: z.enum(["success", "skipped", "failed"]),
  target: z.string().min(1),
  message: z.string().min(1),
  createdAt: z.string().datetime(),
  fallbackUsed: z.boolean().default(false),
  currentVideoId: z.string().min(1).optional(),
  geometryStatus: z.string().min(1).nullable().default(null),
  visualTarget: VisualTargetSchema.nullable().default(null),
  visualActionResult: VisualActionResultSchema.nullable().default(null),
});

export const ActionLogSchema = z.object({
  id: z.string().min(1),
  taskRunId: z.string().min(1),
  roundId: z.string().min(1),
  platformId: z.string().min(1),
  actionType: PlatformActionTypeSchema,
  actionPurpose: EvidencePacketActionPurposeSchema.default("runtime_support"),
  triggerSource: EvidencePacketActionTriggerSourceSchema.default("runtime_policy"),
  beforeEvidenceId: z.string().min(1).nullable().default(null),
  afterEvidenceId: z.string().min(1).nullable().default(null),
  status: z.enum(["success", "skipped", "failed"]),
  message: z.string().min(1),
  failureReason: z.string().min(1).nullable().default(null),
  visualTargetId: z.string().min(1).nullable().default(null),
  targetType: VisualTargetTypeSchema.nullable().default(null),
  boundingBox: VisualBoundingBoxSchema.nullable().default(null),
  confidence: z.number().min(0).max(1).nullable().default(null),
  geometryStatus: z.string().min(1).nullable().default(null),
  verificationResult: VisualActionResultSchema.shape.verificationResult.nullable().default(null),
  createdAt: z.string().datetime(),
  evidenceRefs: z.array(EvidenceRefSchema),
  aiTaskRefs: z.array(z.string().min(1)).default([])
});

export type PlatformActionType = z.infer<typeof PlatformActionTypeSchema>;
export type PlatformActionRequest = z.infer<typeof PlatformActionRequestSchema>;
export type PlatformActionResult = z.infer<typeof PlatformActionResultSchema>;
export type ActionLog = z.infer<typeof ActionLogSchema>;