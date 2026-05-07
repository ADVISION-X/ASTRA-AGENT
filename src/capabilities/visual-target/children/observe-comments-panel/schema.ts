import { z } from "zod";

import { VisualTargetAbilityInputSchema, VisualTargetNonSuccessResultSchema, VisualTargetRegionSuccessResultSchema } from "../../schema.js";

export const ObserveCommentsPanelInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("observe-comments-panel"),
  targetType: z.literal("comments_panel"),
  targetNature: z.literal("region"),
}).strict();

export const ObserveCommentsPanelResultSchema = z.union([
  VisualTargetRegionSuccessResultSchema.extend({ childCapabilityId: z.literal("observe-comments-panel"), targetType: z.literal("comments_panel") }).strict(),
  VisualTargetNonSuccessResultSchema.extend({ childCapabilityId: z.literal("observe-comments-panel"), targetType: z.literal("comments_panel"), targetNature: z.literal("region") }).strict(),
]);