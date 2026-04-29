import type { z } from "zod";

import { ShowCapabilityHealthInputSchema, ShowCapabilityHealthOutputSchema } from "./schema.js";

export type ShowCapabilityHealthInput = z.infer<typeof ShowCapabilityHealthInputSchema>;
export type ShowCapabilityHealthOutput = z.infer<typeof ShowCapabilityHealthOutputSchema>;