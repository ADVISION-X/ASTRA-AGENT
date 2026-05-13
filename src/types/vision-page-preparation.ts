import { z } from "zod";

import { VisionProductPresenceRequestInputSchema } from "./vision-product-presence.js";

const VisionPagePreparationPromptIdSchema = z.literal("vision.pagePreparation.v1");
const VisionPagePreparationTaskTypeSchema = z.literal("vision.pagePreparation");
const VisionPagePreparationPromptVersionSchema = z.literal("v1");
const VisionPagePreparationSchemaVersionSchema = z.literal("vision.pagePreparation.schema.v1");
const VisionPagePreparationDecisionSchema = z.enum(["yes", "no"]);
const VisionPagePreparationRequestInputSchema = VisionProductPresenceRequestInputSchema;

const VisionPagePreparationPayloadSchema = z.object({
  taskType: VisionPagePreparationTaskTypeSchema,
  promptId: VisionPagePreparationPromptIdSchema,
  promptVersion: VisionPagePreparationPromptVersionSchema,
  schemaVersion: VisionPagePreparationSchemaVersionSchema,
  decision: VisionPagePreparationDecisionSchema,
  visualSummary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  evidenceObservations: z.array(z.string().min(1)).default([]),
  readinessSignals: z.array(z.string().min(1)).default([]),
  blockingSignals: z.array(z.string().min(1)).default([]),
  mustReview: z.literal(false).default(false),
}).strict();

const validateVisionPagePreparationResult = (input: unknown) => VisionPagePreparationPayloadSchema.parse(input);

type VisionPagePreparationRequestInput = z.infer<typeof VisionPagePreparationRequestInputSchema>;
type VisionPagePreparationPayload = z.infer<typeof VisionPagePreparationPayloadSchema>;
type VisionPagePreparationResult = VisionPagePreparationPayload;

export {
  VisionPagePreparationPromptIdSchema,
  VisionPagePreparationTaskTypeSchema,
  VisionPagePreparationPromptVersionSchema,
  VisionPagePreparationSchemaVersionSchema,
  VisionPagePreparationDecisionSchema,
  VisionPagePreparationRequestInputSchema,
  VisionPagePreparationPayloadSchema,
  validateVisionPagePreparationResult,
};

export type {
  VisionPagePreparationRequestInput,
  VisionPagePreparationPayload,
  VisionPagePreparationResult,
};