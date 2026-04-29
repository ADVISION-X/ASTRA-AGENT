import type { z } from "zod";

import { MarkReviewRequiredInputSchema, MarkReviewRequiredOutputSchema } from "./schema.js";

export type MarkReviewRequiredInput = z.infer<typeof MarkReviewRequiredInputSchema>;
export type MarkReviewRequiredOutput = z.infer<typeof MarkReviewRequiredOutputSchema>;