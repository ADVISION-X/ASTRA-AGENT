import { z } from "zod";

import { VisualTargetAbilityInputSchema, VisualTargetActionSuccessResultSchema, VisualTargetNonSuccessResultSchema } from "../../schema.js";

export const DetectSaveButtonInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("detect-save-button"),
  targetType: z.literal("save_button"),
  targetNature: z.literal("action"),
}).strict();

export const DetectSaveButtonResultSchema = z.union([
  VisualTargetActionSuccessResultSchema.extend({ childCapabilityId: z.literal("detect-save-button"), targetType: z.literal("save_button") }).strict(),
  VisualTargetNonSuccessResultSchema.extend({ childCapabilityId: z.literal("detect-save-button"), targetType: z.literal("save_button"), targetNature: z.literal("action") }).strict(),
]);