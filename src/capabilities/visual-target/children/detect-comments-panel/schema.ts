import { z } from "zod";

import { VisualTargetAbilityInputSchema, VisualTargetNonSuccessResultSchema, VisualTargetRegionSuccessResultSchema } from "../../schema.js";

export const DetectCommentsPanelInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("detect-comments-panel"),
  targetType: z.literal("comments_panel"),
  targetNature: z.literal("region"),
}).strict();

export const DetectCommentsPanelResultSchema = z.union([
  VisualTargetRegionSuccessResultSchema.extend({ childCapabilityId: z.literal("detect-comments-panel"), targetType: z.literal("comments_panel") }).strict(),
  VisualTargetNonSuccessResultSchema.extend({ childCapabilityId: z.literal("detect-comments-panel"), targetType: z.literal("comments_panel"), targetNature: z.literal("region") }).strict(),
]);