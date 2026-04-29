import { z } from "zod";

import { CommanderCapabilityRosterEntrySchema, EmptyCommanderChildInputSchema } from "../../schema.js";

export const ShowCapabilityRosterInputSchema = EmptyCommanderChildInputSchema;
export const ShowCapabilityRosterOutputSchema = z.array(CommanderCapabilityRosterEntrySchema);