import { z } from "zod";

import { AiChildReadinessSchema, PaidAnalysisAiInputSchema, PaidAnalysisAiResultSchema } from "../../schema.js";

export const PaidAnalysisAiChildInputSchema = PaidAnalysisAiInputSchema.describe("paid-analysis-ai child input");
export const PaidAnalysisAiChildResultSchema = PaidAnalysisAiResultSchema.describe("paid-analysis-ai governed-disabled child result");
export const PaidAnalysisAiChildExecutionPolicySchema = z.object({
  providerKind: z.literal("paid"),
  allowedTaskTypes: z.tuple([z.literal("evidence_packet_analysis"), z.literal("map_authoring")]),
  executable: z.literal(false),
  disabledProviderDecision: z.literal("disabled"),
  forbidsLocalFallback: z.literal(true),
}).strict();
export const PaidAnalysisAiChildReadinessSchema = AiChildReadinessSchema.extend({
  childCapabilityId: z.literal("paid-analysis-ai"),
  providerKind: z.literal("paid"),
  status: z.literal("disabled_by_policy"),
}).strict();

export type PaidAnalysisAiInput = z.output<typeof PaidAnalysisAiChildInputSchema>;
export type PaidAnalysisAiResult = z.output<typeof PaidAnalysisAiChildResultSchema>;
