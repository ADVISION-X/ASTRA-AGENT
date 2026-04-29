import type { z } from "zod";

import { ApproveCandidateInputSchema, ApproveCandidateOutputSchema } from "./schema.js";

export type ApproveCandidateInput = z.infer<typeof ApproveCandidateInputSchema>;
export type ApproveCandidateOutput = z.infer<typeof ApproveCandidateOutputSchema>;