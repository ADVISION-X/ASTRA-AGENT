import { z } from "zod";

const VideoFrameSamplePointLabelSchema = z.enum([
  "frame_3s",
  "frame_6s",
  "frame_10s",
  "adaptive_first",
  "adaptive_mid",
  "adaptive_late",
]);

const MultiFrameSamplingStrategySchema = z.enum([
  "fixed_3_6",
  "fixed_3_6_10",
  "adaptive_short_video",
  "route_plan_or_ability_owned_sampling",
  "single_frame_fallback",
]);

const ProductPresenceInputModeSchema = z.enum([
  "multi_frame_contact_sheet",
  "multi_image",
  "single_frame_fallback",
]);

const VideoFrameSamplePointSchema = z.object({
  label: VideoFrameSamplePointLabelSchema,
  targetTimestampSec: z.number().nonnegative().nullable().default(null),
  actualTimestampSec: z.number().nonnegative().nullable().default(null),
  screenshotEvidenceId: z.string().min(1).nullable().default(null),
  screenshotHash: z.string().min(1).nullable().default(null),
  storageRef: z.string().min(1).nullable().default(null),
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
  capturedAt: z.string().datetime().nullable().default(null),
  unavailableReason: z.string().min(1).nullable().default(null),
});

const MultiFrameVideoEvidenceSetSchema = z.object({
  multiFrameEvidenceSetId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1),
  samplingStrategy: MultiFrameSamplingStrategySchema,
  frames: z.array(VideoFrameSamplePointSchema).min(1),
  validFrameCount: z.number().int().nonnegative(),
  contactSheetEvidenceId: z.string().min(1).nullable().default(null),
  createdAt: z.string().datetime(),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
});

const ProductPresenceMultiFrameAIInputSchema = z.object({
  promptId: z.literal("visual-mission-judge.v1"),
  promptVersion: z.literal("v1"),
  schemaVersion: z.literal("visual-mission-judge.schema.v1"),
  inputMode: ProductPresenceInputModeSchema,
  multiFrameEvidenceSetId: z.string().min(1).nullable().default(null),
  contactSheetEvidenceId: z.string().min(1).nullable().default(null),
  frameEvidenceIds: z.array(z.string().min(1)).default([]),
  validFrameCount: z.number().int().nonnegative(),
});

type VideoFrameSamplePointLabel = z.infer<typeof VideoFrameSamplePointLabelSchema>;
type MultiFrameSamplingStrategy = z.infer<typeof MultiFrameSamplingStrategySchema>;
type ProductPresenceInputMode = z.infer<typeof ProductPresenceInputModeSchema>;
type VideoFrameSamplePoint = z.infer<typeof VideoFrameSamplePointSchema>;
type MultiFrameVideoEvidenceSet = z.infer<typeof MultiFrameVideoEvidenceSetSchema>;
type ProductPresenceMultiFrameAIInput = z.infer<typeof ProductPresenceMultiFrameAIInputSchema>;

export { VideoFrameSamplePointLabelSchema, MultiFrameSamplingStrategySchema, ProductPresenceInputModeSchema, VideoFrameSamplePointSchema, MultiFrameVideoEvidenceSetSchema, ProductPresenceMultiFrameAIInputSchema };
export type { VideoFrameSamplePointLabel, MultiFrameSamplingStrategy, ProductPresenceInputMode, VideoFrameSamplePoint, MultiFrameVideoEvidenceSet, ProductPresenceMultiFrameAIInput };
