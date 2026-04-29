import { z } from "zod";

import { CommanderRuntimeProofTimelineEntrySchema, LimitedReadInputSchema } from "../../schema.js";

export const ShowRuntimeProofTimelineInputSchema = LimitedReadInputSchema;
export const ShowRuntimeProofTimelineOutputSchema = z.array(CommanderRuntimeProofTimelineEntrySchema);