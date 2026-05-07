import { z } from "zod";

import { VisualTargetAbilityInputSchema, VisualTargetActionSuccessResultSchema, VisualTargetNonSuccessResultSchema } from "../../schema.js";

export const ObserveCommentsButtonInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("observe-comments-button"),
  targetType: z.literal("comments_button"),
  targetNature: z.literal("action"),
}).strict();

export const ObserveCommentsButtonResultSchema = z.union([
  VisualTargetActionSuccessResultSchema.extend({ childCapabilityId: z.literal("observe-comments-button"), targetType: z.literal("comments_button") }).strict(),
  VisualTargetNonSuccessResultSchema.extend({ childCapabilityId: z.literal("observe-comments-button"), targetType: z.literal("comments_button"), targetNature: z.literal("action") }).strict(),
]);