import { z } from "zod";

import {
  VisionProductPresenceMissingFrameSchema,
  VisionProductPresenceRequestInputSchema,
} from "./vision-product-presence.js";

const nonNegativeFinite = z.number().finite().nonnegative();
const positiveFinite = z.number().finite().positive();

const VisionNextItemTargetCandidatePromptIdSchema = z.literal("vision.nextItemTargetCandidate.v1");
const VisionNextItemTargetCandidateTaskTypeSchema = z.literal("vision.nextItemTargetCandidate");
const VisionNextItemTargetCandidatePromptVersionSchema = z.literal("v1");
const VisionNextItemTargetCandidateSchemaVersionSchema = z.literal("vision.nextItemTargetCandidate.schema.v1");
const VisionNextItemTargetCandidateCoordinateSpaceSchema = z.enum(["browser_viewport", "source_image"]);

const VisionNextItemTargetBoundingBoxSchema = z.object({
  x: nonNegativeFinite,
  y: nonNegativeFinite,
  width: positiveFinite,
  height: positiveFinite,
}).strict();

const VisionNextItemTargetClickPointSchema = z.object({
  x: nonNegativeFinite,
  y: nonNegativeFinite,
}).strict();

const VisionNextItemTargetCandidateSchema = z.object({
  candidateId: z.string().min(1),
  targetType: z.literal("next_item_target_candidate"),
  coordinateSpace: VisionNextItemTargetCandidateCoordinateSpaceSchema,
  boundingBox: VisionNextItemTargetBoundingBoxSchema,
  clickPoint: VisionNextItemTargetClickPointSchema,
  confidence: z.number().min(0).max(1),
  visibleText: z.string().min(1).nullable().default(null),
  evidenceObservations: z.array(z.string().min(1)).default([]),
  uncertainty: z.array(z.string().min(1)).default([]),
}).strict();

const VisionNextItemTargetCandidateRequestInputSchema = VisionProductPresenceRequestInputSchema;

const VisionNextItemTargetCandidatePayloadSchema = z.object({
  taskType: VisionNextItemTargetCandidateTaskTypeSchema,
  promptId: VisionNextItemTargetCandidatePromptIdSchema,
  promptVersion: VisionNextItemTargetCandidatePromptVersionSchema,
  schemaVersion: VisionNextItemTargetCandidateSchemaVersionSchema,
  inputMode: VisionNextItemTargetCandidateRequestInputSchema.shape.inputMode,
  multiFrameEvidenceSetId: VisionNextItemTargetCandidateRequestInputSchema.shape.multiFrameEvidenceSetId,
  contactSheetEvidenceId: VisionNextItemTargetCandidateRequestInputSchema.shape.contactSheetEvidenceId,
  frameEvidenceIds: VisionNextItemTargetCandidateRequestInputSchema.shape.frameEvidenceIds,
  screenshotEvidenceId: VisionNextItemTargetCandidateRequestInputSchema.shape.screenshotEvidenceId,
  sampledFrameCount: VisionNextItemTargetCandidateRequestInputSchema.shape.sampledFrameCount,
  validFrameCount: VisionNextItemTargetCandidateRequestInputSchema.shape.validFrameCount,
  expectedFrameCount: VisionNextItemTargetCandidateRequestInputSchema.shape.expectedFrameCount,
  fallbackReason: VisionNextItemTargetCandidateRequestInputSchema.shape.fallbackReason,
  missingFrames: z.array(VisionProductPresenceMissingFrameSchema).default([]),
  targetCandidates: z.array(VisionNextItemTargetCandidateSchema).max(10),
  nonExecutableSummary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidenceObservations: z.array(z.string().min(1)).default([]),
  reason: z.string().min(1),
  uncertainty: z.array(z.string().min(1)).default([]),
  mustReview: z.boolean(),
}).strict();

const validateVisionNextItemTargetCandidateResult = (input: unknown) =>
  VisionNextItemTargetCandidatePayloadSchema.parse(input);

type VisionNextItemTargetCandidateRequestInput = z.infer<typeof VisionNextItemTargetCandidateRequestInputSchema>;
type VisionNextItemTargetCandidate = z.infer<typeof VisionNextItemTargetCandidateSchema>;
type VisionNextItemTargetCandidatePayload = z.infer<typeof VisionNextItemTargetCandidatePayloadSchema>;

export {
  VisionNextItemTargetCandidatePromptIdSchema,
  VisionNextItemTargetCandidateTaskTypeSchema,
  VisionNextItemTargetCandidatePromptVersionSchema,
  VisionNextItemTargetCandidateSchemaVersionSchema,
  VisionNextItemTargetCandidateCoordinateSpaceSchema,
  VisionNextItemTargetBoundingBoxSchema,
  VisionNextItemTargetClickPointSchema,
  VisionNextItemTargetCandidateSchema,
  VisionNextItemTargetCandidateRequestInputSchema,
  VisionNextItemTargetCandidatePayloadSchema,
  validateVisionNextItemTargetCandidateResult,
};

export type {
  VisionNextItemTargetCandidateRequestInput,
  VisionNextItemTargetCandidate,
  VisionNextItemTargetCandidatePayload,
};