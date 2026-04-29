import { z } from "zod";

import { AiChildReadinessSchema, PaidVisionAiInputSchema, PaidVisionAiResultSchema } from "../../schema.js";

export const PaidVisionAiChildInputSchema = PaidVisionAiInputSchema.describe("paid-vision-ai child input");
export const PaidVisionAiChildResultSchema = PaidVisionAiResultSchema.describe("paid-vision-ai governed-disabled child result");
export const PaidVisionAiChildExecutionPolicySchema = z.object({
  providerKind: z.literal("paid"),
  allowedTaskTypes: z.tuple([z.literal("visual_observation"), z.literal("visual_target_candidate_analysis")]),
  executable: z.literal(false),
  disabledProviderDecision: z.literal("disabled"),
  forbidsLocalFallback: z.literal(true),
}).strict();
export const PaidVisionAiChildReadinessSchema = AiChildReadinessSchema.extend({
  childCapabilityId: z.literal("paid-vision-ai"),
  providerKind: z.literal("paid"),
  status: z.literal("disabled_by_policy"),
}).strict();

export type PaidVisionAiInput = z.output<typeof PaidVisionAiChildInputSchema>;
export type PaidVisionAiResult = z.output<typeof PaidVisionAiChildResultSchema>;
