import { z } from "zod";

export const PromptBindingItemSchema = z.object({
  stepId: z.string().min(1),
  promptContractId: z.string().min(1),
  expectedOutputSchema: z.string().min(1),
  confidencePolicy: z.string().min(1),
  reviewPolicy: z.string().min(1),
  failureBranch: z.string().min(1)
}).strict();

export const PromptBindingsSchema = z.object({
  bindings: z.array(PromptBindingItemSchema).default([])
}).strict();
