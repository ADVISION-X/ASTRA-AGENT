import { z } from "zod";

import { CommanderRecordSummaryViewSchema, EmptyCommanderChildInputSchema } from "../../schema.js";

export const ShowReviewQueueInputSchema = EmptyCommanderChildInputSchema;
export const ShowReviewQueueOutputSchema = z.array(CommanderRecordSummaryViewSchema);