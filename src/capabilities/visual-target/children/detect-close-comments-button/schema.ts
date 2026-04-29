import { z } from "zod";

import { VisualTargetAbilityInputSchema, VisualTargetActionSuccessResultSchema, VisualTargetNonSuccessResultSchema } from "../../schema.js";

export const DetectCloseCommentsButtonInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("detect-close-comments-button"),
  targetType: z.literal("close_comments_button"),
  targetNature: z.literal("action"),
}).strict();

export const DetectCloseCommentsButtonResultSchema = z.union([
  VisualTargetActionSuccessResultSchema.extend({ childCapabilityId: z.literal("detect-close-comments-button"), targetType: z.literal("close_comments_button") }).strict(),
  VisualTargetNonSuccessResultSchema.extend({ childCapabilityId: z.literal("detect-close-comments-button"), targetType: z.literal("close_comments_button"), targetNature: z.literal("action") }).strict(),
]);