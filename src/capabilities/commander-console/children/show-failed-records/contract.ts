import type { z } from "zod";

import { ShowFailedRecordsInputSchema, ShowFailedRecordsOutputSchema } from "./schema.js";

export type ShowFailedRecordsInput = z.infer<typeof ShowFailedRecordsInputSchema>;
export type ShowFailedRecordsOutput = z.infer<typeof ShowFailedRecordsOutputSchema>;