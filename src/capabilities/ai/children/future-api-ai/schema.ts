import { z } from "zod";

import { AiChildReadinessSchema } from "../../schema.js";

export const FutureApiAiChildInputSchema = z.never().describe("future-api-ai has no executable input while law is frozen");
export const FutureApiAiChildResultSchema = z.never().describe("future-api-ai has no executable result while law is frozen");
export const FutureApiAiChildExecutionPolicySchema = z.object({
  providerKind: z.literal("future"),
  allowedTaskTypes: z.tuple([]),
  executable: z.literal(false),
  disabledProviderDecision: z.literal("disabled"),
  forbidsRuntimeExecution: z.literal(true),
  forbidsLocalFallback: z.literal(true),
}).strict();
export const FutureApiAiChildReadinessSchema = AiChildReadinessSchema.extend({
  childCapabilityId: z.literal("future-api-ai"),
  providerKind: z.literal("future"),
  status: z.literal("disabled_by_policy"),
  supportedTaskTypes: z.tuple([]),
}).strict();

export type FutureApiAiInput = z.output<typeof FutureApiAiChildInputSchema>;
export type FutureApiAiResult = z.output<typeof FutureApiAiChildResultSchema>;
