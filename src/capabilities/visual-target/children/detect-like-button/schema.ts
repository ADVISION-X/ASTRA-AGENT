import { z } from "zod";

import { VisualTargetAbilityInputSchema, VisualTargetActionSuccessResultSchema, VisualTargetNonSuccessResultSchema } from "../../schema.js";

export const DetectLikeButtonInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("detect-like-button"),
  targetType: z.literal("like_button"),
  targetNature: z.literal("action"),
}).strict();

export const DetectLikeButtonResultSchema = z.union([
  VisualTargetActionSuccessResultSchema.extend({ childCapabilityId: z.literal("detect-like-button"), targetType: z.literal("like_button") }).strict(),
  VisualTargetNonSuccessResultSchema.extend({ childCapabilityId: z.literal("detect-like-button"), targetType: z.literal("like_button"), targetNature: z.literal("action") }).strict(),
]);