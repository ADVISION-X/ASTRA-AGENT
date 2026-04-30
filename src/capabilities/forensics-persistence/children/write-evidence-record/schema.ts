import { z } from "zod";

import { OcrTextResultSchema } from "../../../../types/evidence.js";
import { ForensicsAbilityInputBaseSchema, ForensicsPersistedOutputSchema, ImageEvidenceInputSchema } from "../../shared/forensics-base-schema.js";

export const ForensicsEvidenceRecordPayloadSchema = z.union([
  z.object({
    imageEvidenceInput: ImageEvidenceInputSchema,
  }),
  z.object({
    ocrTextResult: OcrTextResultSchema,
  }),
]);

export const WriteEvidenceRecordInputSchema = ForensicsAbilityInputBaseSchema.extend({
  childCapabilityId: z.literal("write-evidence-record"),
  recordType: z.literal("evidence_record"),
  payload: ForensicsEvidenceRecordPayloadSchema,
});

export const WriteEvidenceRecordOutputSchema = ForensicsPersistedOutputSchema;
