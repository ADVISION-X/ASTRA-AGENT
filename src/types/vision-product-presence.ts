import { z } from "zod";

import {
  MultiFrameSamplingStrategySchema,
  ProductPresenceInputModeSchema,
  VideoFrameSamplePointLabelSchema,
} from "./multi-frame-evidence.js";

export const VisionProductPresencePromptIdSchema = z.literal("vision.productPresence.v1");
export const VisionProductPresenceTaskTypeSchema = z.literal("vision.productPresence");
export const VisionProductPresencePromptVersionSchema = z.literal("v1");
export const VisionProductPresenceSchemaVersionSchema = z.literal("vision.productPresence.schema.v1");

export const VisionProductPresenceSuggestedNextActionSchema = z.enum([
  "collect_metrics_like_marker_open_comments",
  "scroll_next",
  "click_not_interested_or_scroll_next",
  "skip_or_operator_review",
  "review_required",
]);

export const VisionProductPresenceRequestInputSchema = z.object({
  inputMode: ProductPresenceInputModeSchema,
  multiFrameEvidenceSetId: z.string().min(1).nullable().default(null),
  contactSheetEvidenceId: z.string().min(1).nullable().default(null),
  frameEvidenceIds: z.array(z.string().min(1)).default([]),
  screenshotEvidenceId: z.string().min(1).nullable().default(null),
  screenshotRegion: z.string().min(1).nullable().default(null),
  sourceUrl: z.string().min(1),
  samplingStrategy: MultiFrameSamplingStrategySchema,
  sampledFrameCount: z.number().int().positive(),
  validFrameCount: z.number().int().nonnegative(),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
});

export const VisionProductPresenceFrameObservationSchema = z.object({
  frameLabel: VideoFrameSamplePointLabelSchema,
  hasVisibleProduct: z.boolean().nullable(),
  visibleProductTypes: z.array(z.string().min(1)).default([]),
  observations: z.array(z.string().min(1)).default([]),
});

export const VisionProductPresencePayloadSchema = z.object({
  taskType: VisionProductPresenceTaskTypeSchema,
  promptId: VisionProductPresencePromptIdSchema,
  promptVersion: VisionProductPresencePromptVersionSchema,
  schemaVersion: VisionProductPresenceSchemaVersionSchema,
  inputMode: ProductPresenceInputModeSchema,
  multiFrameEvidenceSetId: z.string().min(1).nullable().default(null),
  contactSheetEvidenceId: z.string().min(1).nullable().default(null),
  frameEvidenceIds: z.array(z.string().min(1)).default([]),
  screenshotEvidenceId: z.string().min(1).nullable().default(null),
  sampledFrameCount: z.number().int().positive(),
  validFrameCount: z.number().int().nonnegative(),
  isProductVideo: z.boolean().nullable(),
  confidence: z.number().min(0).max(1),
  visibleProductTypes: z.array(z.string().min(1)),
  evidenceObservations: z.array(z.string().min(1)),
  reason: z.string().min(1),
  frameLevelObservations: z.array(VisionProductPresenceFrameObservationSchema).default([]),
  aggregateReason: z.string().min(1),
  suggestedNextAction: VisionProductPresenceSuggestedNextActionSchema,
  uncertainty: z.array(z.string().min(1)),
  mustReview: z.boolean(),
});

export const validateVisionProductPresenceResult = (input: unknown) => VisionProductPresencePayloadSchema.parse(input);

export type VisionProductPresenceSuggestedNextAction = z.infer<typeof VisionProductPresenceSuggestedNextActionSchema>;
export type VisionProductPresenceRequestInput = z.infer<typeof VisionProductPresenceRequestInputSchema>;
export type VisionProductPresenceFrameObservation = z.infer<typeof VisionProductPresenceFrameObservationSchema>;
export type VisionProductPresenceResult = z.infer<typeof VisionProductPresencePayloadSchema>;
export type VisionProductPresencePayload = VisionProductPresenceResult;