import type { z } from "zod";

import { ShowEvidencePacketsInputSchema, ShowEvidencePacketsOutputSchema } from "./schema.js";

export type ShowEvidencePacketsInput = z.infer<typeof ShowEvidencePacketsInputSchema>;
export type ShowEvidencePacketsOutput = z.infer<typeof ShowEvidencePacketsOutputSchema>;