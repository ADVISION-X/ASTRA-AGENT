import type { z } from "zod";

import { IssueHumanCommandInputSchema, IssueHumanCommandOutputSchema } from "./schema.js";

export type IssueHumanCommandInput = z.infer<typeof IssueHumanCommandInputSchema>;
export type IssueHumanCommandOutput = z.infer<typeof IssueHumanCommandOutputSchema>;