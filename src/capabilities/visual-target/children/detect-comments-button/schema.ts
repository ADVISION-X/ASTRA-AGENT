import { z } from "zod";

import { VisualTargetAbilityInputSchema, VisualTargetActionSuccessResultSchema, VisualTargetNonSuccessResultSchema } from "../../schema.js";

export const DetectCommentsButtonInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("detect-comments-button"),
  targetType: z.literal("comments_button"),
  targetNature: z.literal("action"),
}).strict();

export const DetectCommentsButtonResultSchema = z.union([
  VisualTargetActionSuccessResultSchema.extend({ childCapabilityId: z.literal("detect-comments-button"), targetType: z.literal("comments_button") }).strict(),
  VisualTargetNonSuccessResultSchema.extend({ childCapabilityId: z.literal("detect-comments-button"), targetType: z.literal("comments_button"), targetNature: z.literal("action") }).strict(),
]);