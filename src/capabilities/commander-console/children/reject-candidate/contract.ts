import type { z } from "zod";

import { RejectCandidateInputSchema, RejectCandidateOutputSchema } from "./schema.js";

export type RejectCandidateInput = z.infer<typeof RejectCandidateInputSchema>;
export type RejectCandidateOutput = z.infer<typeof RejectCandidateOutputSchema>;