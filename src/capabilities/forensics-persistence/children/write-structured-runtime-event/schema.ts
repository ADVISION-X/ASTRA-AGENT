import { z } from "zod";

import { RoundLifecycleEventSchema } from "../../../../types/evidence-packet.js";
import { StructuredRuntimeEventSchema } from "../../../../types/structured-log.js";
import { ForensicsAbilityInputBaseSchema, ForensicsPersistedOutputSchema } from "../../shared/forensics-base-schema.js";

export const ForensicsStructuredRuntimeEventPayloadSchema = z.object({
  structuredRuntimeEvent: StructuredRuntimeEventSchema,
  roundLifecycleEvent: RoundLifecycleEventSchema.optional(),
});

export const WriteStructuredRuntimeEventInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("write-structured-runtime-event"),
  recordType: z.literal("structured_runtime_event"),
  payload: ForensicsStructuredRuntimeEventPayloadSchema,
});

export const WriteStructuredRuntimeEventOutputSchema = ForensicsPersistedOutputSchema;
