import { z } from "zod";

import { VisualTargetAbilityInputSchema, VisualTargetActionSuccessResultSchema, VisualTargetNonSuccessResultSchema } from "../../schema.js";

export const ObserveNotInterestedButtonInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("observe-not-interested-button"),
  targetType: z.literal("not_interested_button"),
  targetNature: z.literal("action"),
}).strict();

export const ObserveNotInterestedButtonResultSchema = z.union([
  VisualTargetActionSuccessResultSchema.extend({ childCapabilityId: z.literal("observe-not-interested-button"), targetType: z.literal("not_interested_button") }).strict(),
  VisualTargetNonSuccessResultSchema.extend({ childCapabilityId: z.literal("observe-not-interested-button"), targetType: z.literal("not_interested_button"), targetNature: z.literal("action") }).strict(),
]);