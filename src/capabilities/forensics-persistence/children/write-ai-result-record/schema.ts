import { z } from "zod";

import { ForensicsAbilityInputBaseSchema, ForensicsPersistedOutputSchema, ForensicsPlainObjectSchema } from "../../shared/forensics-base-schema.js";

export const ForensicsAiResultRecordPayloadSchema = z.object({
  aiResult: ForensicsPlainObjectSchema,
});

export const WriteAiResultRecordInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("write-ai-result-record"),
  recordType: z.literal("ai_result_record"),
  promptContractId: z.string().min(1),
  promptContractVersion: z.string().min(1),
  promptCatalogVersion: z.string().min(1),
  payload: ForensicsAiResultRecordPayloadSchema,
});

export const WriteAiResultRecordOutputSchema = ForensicsPersistedOutputSchema;
