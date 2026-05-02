import { z } from "zod";

import { ForensicsAbilityInputBaseSchema, ForensicsPersistedOutputSchema, ForensicsPlainObjectSchema } from "../../shared/forensics-base-schema.js";

export const ForensicsStructuredRuntimeEventPayloadSchema = z.object({
  structuredRuntimeEvent: ForensicsPlainObjectSchema,
  roundLifecycleEvent: ForensicsPlainObjectSchema.optional(),
});

export const WriteStructuredRuntimeEventInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("write-structured-runtime-event"),
  recordType: z.literal("structured_runtime_event"),
  payload: ForensicsStructuredRuntimeEventPayloadSchema,
});

export const WriteStructuredRuntimeEventOutputSchema = ForensicsPersistedOutputSchema;
