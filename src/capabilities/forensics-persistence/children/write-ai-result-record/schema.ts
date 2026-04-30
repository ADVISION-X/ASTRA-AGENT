import { z } from "zod";

import { StoredAiResultSchema } from "../../../../types/stored-ai-result.js";
import { ForensicsAbilityInputBaseSchema, ForensicsPersistedOutputSchema } from "../../shared/forensics-base-schema.js";

export const ForensicsAiResultRecordPayloadSchema = z.object({
  aiResult: StoredAiResultSchema,
});

export const WriteAiResultRecordInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("write-ai-result-record"),
  recordType: z.literal("ai_result_record"),
  payload: ForensicsAiResultRecordPayloadSchema,
});

export const WriteAiResultRecordOutputSchema = ForensicsPersistedOutputSchema;
