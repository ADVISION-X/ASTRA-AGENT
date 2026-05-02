import { z } from "zod";

import { ForensicsAbilityInputBaseSchema, ForensicsPersistedOutputSchema, ForensicsPlainObjectSchema } from "../../shared/forensics-base-schema.js";

export const ForensicsStructuredActionLogPayloadSchema = z.object({
  actionLog: ForensicsPlainObjectSchema.optional(),
  structuredActionLog: ForensicsPlainObjectSchema,
});

export const WriteStructuredActionLogInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("write-structured-action-log"),
  recordType: z.literal("structured_action_log"),
  actionRef: z.string().min(1),
  postActionVerificationRef: z.string().min(1),
  payload: ForensicsStructuredActionLogPayloadSchema,
});

export const WriteStructuredActionLogOutputSchema = ForensicsPersistedOutputSchema;
