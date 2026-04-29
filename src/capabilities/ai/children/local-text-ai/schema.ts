import { z } from "zod";

import { AiChildReadinessSchema, LocalTextAiInputSchema, LocalTextAiResultSchema } from "../../schema.js";

export const LocalTextAiChildInputSchema = LocalTextAiInputSchema.describe("local-text-ai child input");
export const LocalTextAiChildResultSchema = LocalTextAiResultSchema.describe("local-text-ai child result");
export const LocalTextAiChildExecutionPolicySchema = z.object({
  providerKind: z.literal("local"),
  allowedTaskTypes: z.tuple([z.literal("comment_signal_summary"), z.literal("product_signal_summary")]),
  requiresLocalRuntime: z.literal(true),
  forbidsPlatformActions: z.literal(true),
}).strict();
export const LocalTextAiChildReadinessSchema = AiChildReadinessSchema.extend({
  childCapabilityId: z.literal("local-text-ai"),
  providerKind: z.literal("local"),
}).strict();

export type LocalTextAiInput = z.output<typeof LocalTextAiChildInputSchema>;
export type LocalTextAiResult = z.output<typeof LocalTextAiChildResultSchema>;
