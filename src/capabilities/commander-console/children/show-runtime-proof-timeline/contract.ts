import type { z } from "zod";

import { ShowRuntimeProofTimelineInputSchema, ShowRuntimeProofTimelineOutputSchema } from "./schema.js";

export type ShowRuntimeProofTimelineInput = z.infer<typeof ShowRuntimeProofTimelineInputSchema>;
export type ShowRuntimeProofTimelineOutput = z.infer<typeof ShowRuntimeProofTimelineOutputSchema>;