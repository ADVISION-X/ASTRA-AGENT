import type { z } from "zod";

import { ShowCapabilityRosterInputSchema, ShowCapabilityRosterOutputSchema } from "./schema.js";

export type ShowCapabilityRosterInput = z.infer<typeof ShowCapabilityRosterInputSchema>;
export type ShowCapabilityRosterOutput = z.infer<typeof ShowCapabilityRosterOutputSchema>;