import { z } from "zod";

import { Pick3AiProviderKindSchema } from "./pick3-is-blind-eval.schema.js";

export const Pick3ResumeInputSchema = z.object({
  taskId: z.string().trim().min(1),
  providerKind: Pick3AiProviderKindSchema.optional(),
}).strict();

export type Pick3ResumeInput = z.infer<typeof Pick3ResumeInputSchema>;
