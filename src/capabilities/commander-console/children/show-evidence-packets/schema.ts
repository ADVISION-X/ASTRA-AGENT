import { z } from "zod";

import { CommanderRecordSummaryViewSchema, LimitedReadInputSchema } from "../../schema.js";

export const ShowEvidencePacketsInputSchema = LimitedReadInputSchema;
export const ShowEvidencePacketsOutputSchema = z.array(CommanderRecordSummaryViewSchema);