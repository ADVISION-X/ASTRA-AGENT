import { z } from "zod";

import { AiChildReadinessSchema, LocalVisionAiInputSchema, LocalVisionAiResultSchema } from "../../schema.js";

export const LocalVisionAiChildInputSchema = LocalVisionAiInputSchema.describe("local-vision-ai child input");
export const LocalVisionAiChildResultSchema = LocalVisionAiResultSchema.describe("local-vision-ai child result");
export const LocalVisionAiChildExecutionPolicySchema = z.object({
  providerKind: z.literal("local"),
  allowedTaskTypes: z.tuple([
    z.literal("page_preparation_judgment"),
    z.literal("product_presence_judgment"),
    z.literal("visual_observation"),
    z.literal("visual_mission_action_plan"),
    z.literal("visual_target_candidate_analysis"),
  ]),
  requiresLocalRuntime: z.literal(true),
  forbidsPlatformActions: z.literal(true),
}).strict();
export const LocalVisionAiChildReadinessSchema = AiChildReadinessSchema.extend({
  childCapabilityId: z.literal("local-vision-ai"),
  providerKind: z.literal("local"),
}).strict();

export type LocalVisionAiInput = z.output<typeof LocalVisionAiChildInputSchema>;
export type LocalVisionAiResult = z.output<typeof LocalVisionAiChildResultSchema>;
