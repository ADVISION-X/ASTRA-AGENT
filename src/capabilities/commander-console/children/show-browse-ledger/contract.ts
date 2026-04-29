import type { z } from "zod";

import { ShowBrowseLedgerInputSchema, ShowBrowseLedgerOutputSchema } from "./schema.js";

export type ShowBrowseLedgerInput = z.infer<typeof ShowBrowseLedgerInputSchema>;
export type ShowBrowseLedgerOutput = z.infer<typeof ShowBrowseLedgerOutputSchema>;