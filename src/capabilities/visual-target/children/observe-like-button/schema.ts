import { z } from "zod";

import { VisualTargetAbilityInputSchema, VisualTargetActionSuccessResultSchema, VisualTargetNonSuccessResultSchema } from "../../schema.js";

export const ObserveLikeButtonInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("observe-like-button"),
  targetType: z.literal("like_button"),
  targetNature: z.literal("action"),
}).strict();

export const ObserveLikeButtonResultSchema = z.union([
  VisualTargetActionSuccessResultSchema.extend({ childCapabilityId: z.literal("observe-like-button"), targetType: z.literal("like_button") }).strict(),
  VisualTargetNonSuccessResultSchema.extend({ childCapabilityId: z.literal("observe-like-button"), targetType: z.literal("like_button"), targetNature: z.literal("action") }).strict(),
]);