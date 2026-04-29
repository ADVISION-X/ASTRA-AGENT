import { z } from "zod";

import { AiChildReadinessSchema, LocalOcrAiInputSchema, LocalOcrAiResultSchema } from "../../schema.js";

export const LocalOcrAiChildInputSchema = LocalOcrAiInputSchema.describe("local-ocr-ai child input");
export const LocalOcrAiChildResultSchema = LocalOcrAiResultSchema.describe("local-ocr-ai child result");
export const LocalOcrAiChildExecutionPolicySchema = z.object({
  providerKind: z.literal("local"),
  allowedTaskTypes: z.tuple([z.literal("ocr_cleanup")]),
  requiresLocalRuntime: z.literal(true),
  forbidsPlatformActions: z.literal(true),
}).strict();
export const LocalOcrAiChildReadinessSchema = AiChildReadinessSchema.extend({
  childCapabilityId: z.literal("local-ocr-ai"),
  providerKind: z.literal("local"),
}).strict();

export type LocalOcrAiInput = z.output<typeof LocalOcrAiChildInputSchema>;
export type LocalOcrAiResult = z.output<typeof LocalOcrAiChildResultSchema>;
