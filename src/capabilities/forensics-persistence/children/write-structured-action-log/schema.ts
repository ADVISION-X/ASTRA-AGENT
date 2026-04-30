import { z } from "zod";

import { ActionLogSchema } from "../../../../types/platform-action.js";
import { StructuredActionLogSchema } from "../../../../types/structured-log.js";
import { ForensicsAbilityInputBaseSchema, ForensicsPersistedOutputSchema } from "../../shared/forensics-base-schema.js";

export const ForensicsStructuredActionLogPayloadSchema = z.object({
  actionLog: ActionLogSchema.optional(),
  structuredActionLog: StructuredActionLogSchema,
});

export const WriteStructuredActionLogInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("write-structured-action-log"),
  recordType: z.literal("structured_action_log"),
  payload: ForensicsStructuredActionLogPayloadSchema,
});

export const WriteStructuredActionLogOutputSchema = ForensicsPersistedOutputSchema;
