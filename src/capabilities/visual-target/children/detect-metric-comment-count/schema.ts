import { z } from "zod";

import { VisualTargetAbilityInputSchema, VisualTargetMetricSuccessResultSchema, VisualTargetNonSuccessResultSchema } from "../../schema.js";

export const DetectMetricCommentCountInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("detect-metric-comment-count"),
  targetType: z.literal("metric_comment_count"),
  targetNature: z.literal("metric"),
}).strict();

export const DetectMetricCommentCountResultSchema = z.union([
  VisualTargetMetricSuccessResultSchema.extend({ childCapabilityId: z.literal("detect-metric-comment-count"), targetType: z.literal("metric_comment_count") }).strict(),
  VisualTargetNonSuccessResultSchema.extend({ childCapabilityId: z.literal("detect-metric-comment-count"), targetType: z.literal("metric_comment_count"), targetNature: z.literal("metric") }).strict(),
]);