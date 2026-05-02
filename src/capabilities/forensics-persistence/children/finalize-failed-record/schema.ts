import { z } from "zod";

import { ForensicsAbilityInputBaseSchema, ForensicsPersistedOutputSchema, ForensicsPlainObjectSchema } from "../../shared/forensics-base-schema.js";

export const ForensicsFailedRecordPayloadSchema = z.object({
  evidencePacket: ForensicsPlainObjectSchema.nullable().default(null),
  browseLedgerEntry: ForensicsPlainObjectSchema.nullable().default(null),
  roundStructuralLog: ForensicsPlainObjectSchema,
  rebuildSessionId: z.string().min(1).optional(),
});

export const FinalizeFailedRecordInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("finalize-failed-record"),
  recordType: z.literal("failed_record"),
  decisionRef: z.string().min(1),
  payload: ForensicsFailedRecordPayloadSchema,
});

export const FinalizeFailedRecordOutputSchema = ForensicsPersistedOutputSchema;
