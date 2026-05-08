import { z } from "zod";

import { VisualTargetActionSuccessResultSchema, VisualTargetAbilityInputSchema, VisualTargetNonSuccessResultSchema } from "../../schema.js";

export const ObserveNextItemTargetCandidateInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("observe-next-item-target-candidate"),
  targetType: z.literal("next_item_target_candidate"),
  targetNature: z.literal("action"),
}).strict();

export const ObserveNextItemTargetCandidateResultSchema = z.union([
  VisualTargetActionSuccessResultSchema.extend({
    childCapabilityId: z.literal("observe-next-item-target-candidate"),
    targetType: z.literal("next_item_target_candidate"),
  }).strict(),
  VisualTargetNonSuccessResultSchema.extend({
    childCapabilityId: z.literal("observe-next-item-target-candidate"),
    targetType: z.literal("next_item_target_candidate"),
    targetNature: z.literal("action"),
  }).strict(),
]);