import { z } from "zod";

import {
  MultiFrameSamplingStrategySchema,
  ProductPresenceInputModeSchema,
  VideoFrameSamplePointLabelSchema,
} from "./multi-frame-evidence.js";
import { VisualMissionActionPlanOutputSchema as VisualMissionActionPlanSchema } from "./visual-mission-action-plan.js";

const VisualMissionPageStateDecisionSchema = z.string().min(1);

const VisionProductPresenceMissingFrameSchema = z.object({
  frameLabel: VideoFrameSamplePointLabelSchema,
  unavailableReason: z.string().min(1),
});

const VisionProductPresencePromptIdSchema = z.literal("visual-mission-judge.v1");
const VisionProductPresenceTaskTypeSchema = z.literal("vision.productPresence");
const VisionProductPresencePromptVersionSchema = z.literal("v1");
const VisionProductPresenceSchemaVersionSchema = z.literal("visual-mission-judge.schema.v1");

const VisionProductPresenceTaskDecisionSchema = z.enum([
  "goal_matched",
  "goal_not_matched",
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
  samplingFailureReason: z.string().min(1).nullable().default(null),
  missingFrames: z.array(VisionProductPresenceMissingFrameSchema).default([]),
  userRequirementRef: z.string().min(1).nullable().default(null),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
});

const VisionProductPresenceFrameObservationSchema = z.object({
  frameLabel: VideoFrameSamplePointLabelSchema,
  hasVisibleProduct: z.boolean().nullable(),
  visibleMatchTypes: z.array(z.string().min(1)).default([]),
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
  samplingFailureReason: z.string().min(1).nullable().default(null),
  missingFrames: z.array(VisionProductPresenceMissingFrameSchema).default([]),
  goalMatched: z.boolean().nullable(),
  taskDecision: VisionProductPresenceTaskDecisionSchema,
  roundDecision: VisualMissionPageStateDecisionSchema,
  actionPlan: VisualMissionActionPlanSchema,
  visualSummary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  visibleMatchTypes: z.array(z.string().min(1)),
  evidenceObservations: z.array(z.string().min(1)),
  reason: z.string().min(1),
  frameLevelObservations: z.array(VisionProductPresenceFrameObservationSchema).default([]),
  aggregateReason: z.string().min(1),
  ambiguity: z.array(z.string().min(1)),
  mustReview: z.boolean(),
});

const validateVisionProductPresenceResult = (input: unknown) => VisionProductPresencePayloadSchema.parse(input);

type VisionProductPresenceTaskDecision = z.infer<typeof VisionProductPresenceTaskDecisionSchema>;
type VisionProductPresenceRequestInput = z.infer<typeof VisionProductPresenceRequestInputSchema>;
type VisionProductPresenceFrameObservation = z.infer<typeof VisionProductPresenceFrameObservationSchema>;
type VisionProductPresenceResult = z.infer<typeof VisionProductPresencePayloadSchema>;
type VisionProductPresencePayload = VisionProductPresenceResult;

export { VisionProductPresenceMissingFrameSchema, VisionProductPresencePromptIdSchema, VisionProductPresenceTaskTypeSchema, VisionProductPresencePromptVersionSchema, VisionProductPresenceSchemaVersionSchema, VisionProductPresenceTaskDecisionSchema, VisionProductPresenceRequestInputSchema, VisionProductPresenceFrameObservationSchema, VisionProductPresencePayloadSchema, validateVisionProductPresenceResult };
export type { VisionProductPresenceTaskDecision, VisionProductPresenceRequestInput, VisionProductPresenceFrameObservation, VisionProductPresenceResult, VisionProductPresencePayload };
