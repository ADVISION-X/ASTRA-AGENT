import { z } from "zod";

import { CommanderRecordSummaryViewSchema, LimitedReadInputSchema } from "../../schema.js";

export const ShowFailedRecordsInputSchema = LimitedReadInputSchema;
export const ShowFailedRecordsOutputSchema = z.array(CommanderRecordSummaryViewSchema);