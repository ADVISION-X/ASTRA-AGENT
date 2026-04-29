import type { z } from "zod";

import { ShowAuditSummaryInputSchema, ShowAuditSummaryOutputSchema } from "./schema.js";

export type ShowAuditSummaryInput = z.infer<typeof ShowAuditSummaryInputSchema>;
export type ShowAuditSummaryOutput = z.infer<typeof ShowAuditSummaryOutputSchema>;