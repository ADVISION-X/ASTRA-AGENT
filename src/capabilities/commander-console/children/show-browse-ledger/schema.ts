import { z } from "zod";

import { CommanderRecordSummaryViewSchema, LimitedReadInputSchema } from "../../schema.js";

export const ShowBrowseLedgerInputSchema = LimitedReadInputSchema;
export const ShowBrowseLedgerOutputSchema = z.array(CommanderRecordSummaryViewSchema);