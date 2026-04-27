import { z } from "zod";

import { EvidenceRefSchema } from "./evidence.js";
import {
  EvidencePacketActionPurposeSchema,
  EvidencePacketActionTriggerSourceSchema,
  RoundLifecycleStepSchema,
} from "./evidence-packet.js";
import {
  VisualActionVerificationResultSchema,
  VisualBoundingBoxSchema,
  VisualTargetTypeSchema,
} from "./visual-action.js";

export const StructuredLogStatusSchema = z.enum(["started", "success", "failed", "skipped", "review_required"]);

export const StructuredRuntimeEventTypeSchema = z.string().min(1);

export const StructuredActionTypeSchema = RoundLifecycleStepSchema;

export const StructuredActionPurposeSchema = EvidencePacketActionPurposeSchema;

export const StructuredLogRefSchema = z.object({
  refId: z.string().min(1),
  refType: z.enum(["evidence", "action_log", "ai_result", "ledger", "packet", "snapshot", "other"]),
  label: z.string().min(1).nullable().default(null),
});

export const StructuredRuntimeEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: StructuredRuntimeEventTypeSchema,
  sessionId: z.string().min(1),
  roundId: z.string().min(1).nullable().default(null),
  videoVisitId: z.string().min(1).nullable().default(null),
  browserProfileRef: z.string().min(1).nullable().default(null),
  loginState: z.string().min(1).nullable().default(null),
  step: RoundLifecycleStepSchema,
  previousStep: RoundLifecycleStepSchema.nullable().default(null),
  nextStep: RoundLifecycleStepSchema.nullable().default(null),
  status: StructuredLogStatusSchema,
  reason: z.string().min(1).nullable().default(null),
  failureReason: z.string().min(1).nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
  createdAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative().nullable().default(null),
  inputRefs: z.array(EvidenceRefSchema).default([]),
  outputRefs: z.array(EvidenceRefSchema).default([]),
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
  actionLogRefs: z.array(z.string().min(1)).default([]),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
});

export const StructuredActionLogSchema = z.object({
  actionLogId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1).nullable().default(null),
  browserProfileRef: z.string().min(1).nullable().default(null),
  loginState: z.string().min(1).nullable().default(null),
  step: RoundLifecycleStepSchema,
  actionType: StructuredActionTypeSchema,
  actionPurpose: StructuredActionPurposeSchema,
  triggerSource: EvidencePacketActionTriggerSourceSchema,
  inputRefs: z.array(EvidenceRefSchema).default([]),
  outputRefs: z.array(EvidenceRefSchema).default([]),
  beforeEvidenceId: z.string().min(1).nullable().default(null),
  afterEvidenceId: z.string().min(1).nullable().default(null),
  targetDescriptor: z.string().min(1).nullable().default(null),
  visualTargetId: z.string().min(1).nullable().default(null),
  targetType: VisualTargetTypeSchema.nullable().default(null),
  boundingBox: VisualBoundingBoxSchema.nullable().default(null),
  confidence: z.number().min(0).max(1).nullable().default(null),
  geometryStatus: z.string().min(1).nullable().default(null),
  verificationResult: VisualActionVerificationResultSchema.nullable().default(null),
  result: StructuredLogStatusSchema,
  failureReason: z.string().min(1).nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
  createdAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative().nullable().default(null),
});

export const LiveProofLogSequence = [
  "open_target_page_completed",
  "detect_login_or_safety_completed",
  "wait_feed_ready_completed",
  "single_video_round_started",
  "wait_video_stable_completed",
  "identify_current_video_completed",
  "screenshot_video_area_completed",
  "branch_decision_completed",
  "scroll_next_video_completed",
  "next_video_wait_started",
] as const;

export const LiveProofLogSequenceSchema = z.array(StructuredRuntimeEventTypeSchema).superRefine((sequence, ctx) => {
  let cursor = 0;

  for (const eventType of sequence) {
    if (eventType === LiveProofLogSequence[cursor]) {
      cursor += 1;
      if (cursor === LiveProofLogSequence.length) {
        return;
      }
    }
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Live proof sequence is missing one or more required runtime proof events.",
  });
});

export type StructuredLogStatus = z.infer<typeof StructuredLogStatusSchema>;
export type StructuredRuntimeEventType = z.infer<typeof StructuredRuntimeEventTypeSchema>;
export type StructuredActionType = z.infer<typeof StructuredActionTypeSchema>;
export type StructuredActionPurpose = z.infer<typeof StructuredActionPurposeSchema>;
export type StructuredLogRef = z.infer<typeof StructuredLogRefSchema>;
export type StructuredRuntimeEvent = z.infer<typeof StructuredRuntimeEventSchema>;
export type StructuredActionLog = z.infer<typeof StructuredActionLogSchema>;
export type LiveProofLogSequence = typeof LiveProofLogSequence;