import type { z } from "zod";

import { ShowReviewQueueInputSchema, ShowReviewQueueOutputSchema } from "./schema.js";

export type ShowReviewQueueInput = z.infer<typeof ShowReviewQueueInputSchema>;
export type ShowReviewQueueOutput = z.infer<typeof ShowReviewQueueOutputSchema>;