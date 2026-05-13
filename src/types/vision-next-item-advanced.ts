import { z } from "zod";

import { VisionProductPresenceRequestInputSchema } from "./vision-product-presence.js";

const VisionNextItemAdvancedPromptIdSchema = z.literal("vision.nextItemAdvanced.v1");
const VisionNextItemAdvancedTaskTypeSchema = z.literal("vision.nextItemAdvanced");
const VisionNextItemAdvancedPromptVersionSchema = z.literal("v1");
const VisionNextItemAdvancedSchemaVersionSchema = z.literal("vision.nextItemAdvanced.schema.v1");
const VisionNextItemAdvancedDecisionSchema = z.enum(["yes", "no"]);
const VisionNextItemAdvancedRequestInputSchema = VisionProductPresenceRequestInputSchema;

const VisionNextItemAdvancedPayloadSchema = z.object({
  taskType: VisionNextItemAdvancedTaskTypeSchema,
  promptId: VisionNextItemAdvancedPromptIdSchema,
  promptVersion: VisionNextItemAdvancedPromptVersionSchema,
  schemaVersion: VisionNextItemAdvancedSchemaVersionSchema,
  decision: VisionNextItemAdvancedDecisionSchema,
  visualSummary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  evidenceObservations: z.array(z.string().min(1)).default([]),
  readinessSignals: z.array(z.string().min(1)).default([]),
  blockingSignals: z.array(z.string().min(1)).default([]),
  mustReview: z.literal(false).default(false),
}).strict();

const validateVisionNextItemAdvancedResult = (input: unknown) => VisionNextItemAdvancedPayloadSchema.parse(input);

type VisionNextItemAdvancedRequestInput = z.infer<typeof VisionNextItemAdvancedRequestInputSchema>;
type VisionNextItemAdvancedPayload = z.infer<typeof VisionNextItemAdvancedPayloadSchema>;
type VisionNextItemAdvancedResult = VisionNextItemAdvancedPayload;

export {
  VisionNextItemAdvancedPromptIdSchema,
  VisionNextItemAdvancedTaskTypeSchema,
  VisionNextItemAdvancedPromptVersionSchema,
  VisionNextItemAdvancedSchemaVersionSchema,
  VisionNextItemAdvancedDecisionSchema,
  VisionNextItemAdvancedRequestInputSchema,
  VisionNextItemAdvancedPayloadSchema,
  validateVisionNextItemAdvancedResult,
};

export type {
  VisionNextItemAdvancedRequestInput,
  VisionNextItemAdvancedPayload,
  VisionNextItemAdvancedResult,
};