import { z } from "zod";

import { VisualTargetAbilityInputSchema, VisualTargetMetricSuccessResultSchema, VisualTargetNonSuccessResultSchema } from "../../schema.js";

export const ObserveMetricCommentCountInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("observe-metric-comment-count"),
  targetType: z.literal("metric_comment_count"),
  targetNature: z.literal("metric"),
}).strict();

export const ObserveMetricCommentCountResultSchema = z.union([
  VisualTargetMetricSuccessResultSchema.extend({ childCapabilityId: z.literal("observe-metric-comment-count"), targetType: z.literal("metric_comment_count") }).strict(),
  VisualTargetNonSuccessResultSchema.extend({ childCapabilityId: z.literal("observe-metric-comment-count"), targetType: z.literal("metric_comment_count"), targetNature: z.literal("metric") }).strict(),
]);