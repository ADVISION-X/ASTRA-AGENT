import { z } from "zod";

import { VisualTargetAbilityInputSchema, VisualTargetActionSuccessResultSchema, VisualTargetNonSuccessResultSchema } from "../../schema.js";

export const ObserveCloseCommentsButtonInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("observe-close-comments-button"),
  targetType: z.literal("close_comments_button"),
  targetNature: z.literal("action"),
}).strict();

export const ObserveCloseCommentsButtonResultSchema = z.union([
  VisualTargetActionSuccessResultSchema.extend({ childCapabilityId: z.literal("observe-close-comments-button"), targetType: z.literal("close_comments_button") }).strict(),
  VisualTargetNonSuccessResultSchema.extend({ childCapabilityId: z.literal("observe-close-comments-button"), targetType: z.literal("close_comments_button"), targetNature: z.literal("action") }).strict(),
]);