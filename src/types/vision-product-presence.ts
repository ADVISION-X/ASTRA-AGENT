import { z } from "zod";

import {
  MultiFrameSamplingStrategySchema,
  ProductPresenceInputModeSchema,
  VideoFrameSamplePointLabelSchema,
} from "./multi-frame-evidence.js";

const VisionProductPresenceMissingFrameSchema = z.object({
  frameLabel: VideoFrameSamplePointLabelSchema,
  unavailableReason: z.string().min(1),
});

const VisionProductPresencePromptIdSchema = z.literal("vision.productPresence.v1");
const VisionProductPresenceTaskTypeSchema = z.literal("vision.productPresence");
const VisionProductPresencePromptVersionSchema = z.literal("v1");
const VisionProductPresenceSchemaVersionSchema = z.literal("vision.productPresence.schema.v1");

const VisionProductPresenceSuggestedNextActionSchema = z.enum([
  "collect_metrics_like_marker_open_comments",
  "scroll_next",
  "click_not_interested_or_scroll_next",
  "skip_or_operator_review",
  "review_required",
]);

const VisionProductPresenceRequestInputSchema = z.object({
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
  expectedFrameCount: z.number().int().positive().default(3),
  fallbackReason: z.string().min(1).nullable().default(null),
  missingFrames: z.array(VisionProductPresenceMissingFrameSchema).default([]),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
});

const VisionProductPresenceFrameObservationSchema = z.object({
  frameLabel: VideoFrameSamplePointLabelSchema,
  hasVisibleProduct: z.boolean().nullable(),
  visibleProductTypes: z.array(z.string().min(1)).default([]),
  observations: z.array(z.string().min(1)).default([]),
});

const VisionProductPresencePayloadSchema = z.object({
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
  expectedFrameCount: z.number().int().positive().default(3),
  fallbackReason: z.string().min(1).nullable().default(null),
  missingFrames: z.array(VisionProductPresenceMissingFrameSchema).default([]),
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

const validateVisionProductPresenceResult = (input: unknown) => VisionProductPresencePayloadSchema.parse(input);

type VisionProductPresenceSuggestedNextAction = z.infer<typeof VisionProductPresenceSuggestedNextActionSchema>;
type VisionProductPresenceRequestInput = z.infer<typeof VisionProductPresenceRequestInputSchema>;
type VisionProductPresenceFrameObservation = z.infer<typeof VisionProductPresenceFrameObservationSchema>;
type VisionProductPresenceResult = z.infer<typeof VisionProductPresencePayloadSchema>;
type VisionProductPresencePayload = VisionProductPresenceResult;

export { VisionProductPresenceMissingFrameSchema, VisionProductPresencePromptIdSchema, VisionProductPresenceTaskTypeSchema, VisionProductPresencePromptVersionSchema, VisionProductPresenceSchemaVersionSchema, VisionProductPresenceSuggestedNextActionSchema, VisionProductPresenceRequestInputSchema, VisionProductPresenceFrameObservationSchema, VisionProductPresencePayloadSchema, validateVisionProductPresenceResult };
export type { VisionProductPresenceSuggestedNextAction, VisionProductPresenceRequestInput, VisionProductPresenceFrameObservation, VisionProductPresenceResult, VisionProductPresencePayload };
