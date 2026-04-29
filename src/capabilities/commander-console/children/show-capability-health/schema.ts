import { z } from "zod";

import { CommanderCapabilityHealthEntrySchema, EmptyCommanderChildInputSchema } from "../../schema.js";

export const ShowCapabilityHealthInputSchema = EmptyCommanderChildInputSchema;
export const ShowCapabilityHealthOutputSchema = z.array(CommanderCapabilityHealthEntrySchema);