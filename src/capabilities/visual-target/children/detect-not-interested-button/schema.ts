import { z } from "zod";

import { VisualTargetAbilityInputSchema, VisualTargetActionSuccessResultSchema, VisualTargetNonSuccessResultSchema } from "../../schema.js";

export const DetectNotInterestedButtonInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("detect-not-interested-button"),
  targetType: z.literal("not_interested_button"),
  targetNature: z.literal("action"),
}).strict();

export const DetectNotInterestedButtonResultSchema = z.union([
  VisualTargetActionSuccessResultSchema.extend({ childCapabilityId: z.literal("detect-not-interested-button"), targetType: z.literal("not_interested_button") }).strict(),
  VisualTargetNonSuccessResultSchema.extend({ childCapabilityId: z.literal("detect-not-interested-button"), targetType: z.literal("not_interested_button"), targetNature: z.literal("action") }).strict(),
]);