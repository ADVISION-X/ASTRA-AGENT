import { z } from "zod";

import {
  VisionProductPresenceMissingFrameSchema,
  VisionProductPresenceRequestInputSchema,
} from "./vision-product-presence.js";

const nonNegativeFinite = z.number().finite().nonnegative();
const positiveFinite = z.number().finite().positive();

const VisionCommentsEntryTargetCandidatePromptIdSchema = z.literal("vision.commentsEntryTargetCandidate.v1");
const VisionCommentsEntryTargetCandidateTaskTypeSchema = z.literal("vision.commentsEntryTargetCandidate");
const VisionCommentsEntryTargetCandidatePromptVersionSchema = z.literal("v1");
const VisionCommentsEntryTargetCandidateSchemaVersionSchema = z.literal("vision.commentsEntryTargetCandidate.schema.v1");
const VisionCommentsEntryTargetCandidateCoordinateSpaceSchema = z.enum(["browser_viewport", "source_image"]);

const VisionCommentsEntryTargetBoundingBoxSchema = z.object({
  x: nonNegativeFinite,
  y: nonNegativeFinite,
  width: positiveFinite,
  height: positiveFinite,
}).strict();

const VisionCommentsEntryTargetClickPointSchema = z.object({
  x: nonNegativeFinite,
  y: nonNegativeFinite,
}).strict();

const VisionCommentsEntryTargetCandidateSchema = z.object({
  candidateId: z.string().min(1),
  targetType: z.literal("comments_button"),
  coordinateSpace: VisionCommentsEntryTargetCandidateCoordinateSpaceSchema,
  boundingBox: VisionCommentsEntryTargetBoundingBoxSchema,
  clickPoint: VisionCommentsEntryTargetClickPointSchema,
  confidence: z.number().min(0).max(1),
  visibleText: z.string().min(1).nullable().default(null),
  evidenceObservations: z.array(z.string().min(1)).default([]),
  uncertainty: z.array(z.string().min(1)).default([]),
}).strict();

const VisionCommentsEntryTargetCandidateRequestInputSchema = VisionProductPresenceRequestInputSchema;

const VisionCommentsEntryTargetCandidatePayloadSchema = z.object({
  taskType: VisionCommentsEntryTargetCandidateTaskTypeSchema,
  promptId: VisionCommentsEntryTargetCandidatePromptIdSchema,
  promptVersion: VisionCommentsEntryTargetCandidatePromptVersionSchema,
  schemaVersion: VisionCommentsEntryTargetCandidateSchemaVersionSchema,
  inputMode: VisionCommentsEntryTargetCandidateRequestInputSchema.shape.inputMode,
  multiFrameEvidenceSetId: VisionCommentsEntryTargetCandidateRequestInputSchema.shape.multiFrameEvidenceSetId,
  contactSheetEvidenceId: VisionCommentsEntryTargetCandidateRequestInputSchema.shape.contactSheetEvidenceId,
  frameEvidenceIds: VisionCommentsEntryTargetCandidateRequestInputSchema.shape.frameEvidenceIds,
  screenshotEvidenceId: VisionCommentsEntryTargetCandidateRequestInputSchema.shape.screenshotEvidenceId,
  sampledFrameCount: VisionCommentsEntryTargetCandidateRequestInputSchema.shape.sampledFrameCount,
  validFrameCount: VisionCommentsEntryTargetCandidateRequestInputSchema.shape.validFrameCount,
  expectedFrameCount: VisionCommentsEntryTargetCandidateRequestInputSchema.shape.expectedFrameCount,
  fallbackReason: VisionCommentsEntryTargetCandidateRequestInputSchema.shape.fallbackReason,
  missingFrames: z.array(VisionProductPresenceMissingFrameSchema).default([]),
  targetCandidates: z.array(VisionCommentsEntryTargetCandidateSchema).max(10),
  nonExecutableSummary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidenceObservations: z.array(z.string().min(1)).default([]),
  reason: z.string().min(1),
  uncertainty: z.array(z.string().min(1)).default([]),
  mustReview: z.boolean(),
}).strict();

const validateVisionCommentsEntryTargetCandidateResult = (input: unknown) =>
  VisionCommentsEntryTargetCandidatePayloadSchema.parse(input);

type VisionCommentsEntryTargetCandidateRequestInput = z.infer<typeof VisionCommentsEntryTargetCandidateRequestInputSchema>;
type VisionCommentsEntryTargetCandidate = z.infer<typeof VisionCommentsEntryTargetCandidateSchema>;
type VisionCommentsEntryTargetCandidatePayload = z.infer<typeof VisionCommentsEntryTargetCandidatePayloadSchema>;

export {
  VisionCommentsEntryTargetCandidatePromptIdSchema,
  VisionCommentsEntryTargetCandidateTaskTypeSchema,
  VisionCommentsEntryTargetCandidatePromptVersionSchema,
  VisionCommentsEntryTargetCandidateSchemaVersionSchema,
  VisionCommentsEntryTargetCandidateCoordinateSpaceSchema,
  VisionCommentsEntryTargetBoundingBoxSchema,
  VisionCommentsEntryTargetClickPointSchema,
  VisionCommentsEntryTargetCandidateSchema,
  VisionCommentsEntryTargetCandidateRequestInputSchema,
  VisionCommentsEntryTargetCandidatePayloadSchema,
  validateVisionCommentsEntryTargetCandidateResult,
};

export type {
  VisionCommentsEntryTargetCandidateRequestInput,
  VisionCommentsEntryTargetCandidate,
  VisionCommentsEntryTargetCandidatePayload,
};