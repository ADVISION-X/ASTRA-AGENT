import { z } from "zod";

import { VisualTargetAbilityInputSchema, VisualTargetActionSuccessResultSchema, VisualTargetNonSuccessResultSchema } from "../../schema.js";

export const ObserveSaveButtonInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("observe-save-button"),
  targetType: z.literal("save_button"),
  targetNature: z.literal("action"),
}).strict();

export const ObserveSaveButtonResultSchema = z.union([
  VisualTargetActionSuccessResultSchema.extend({ childCapabilityId: z.literal("observe-save-button"), targetType: z.literal("save_button") }).strict(),
  VisualTargetNonSuccessResultSchema.extend({ childCapabilityId: z.literal("observe-save-button"), targetType: z.literal("save_button"), targetNature: z.literal("action") }).strict(),
]);