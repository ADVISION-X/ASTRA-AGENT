import { z } from "zod";

import { VisualTargetAbilityInputSchema, VisualTargetMetricSuccessResultSchema, VisualTargetNonSuccessResultSchema } from "../../schema.js";

export const ObserveMetricLikeCountInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("observe-metric-like-count"),
  targetType: z.literal("metric_like_count"),
  targetNature: z.literal("metric"),
}).strict();

export const ObserveMetricLikeCountResultSchema = z.union([
  VisualTargetMetricSuccessResultSchema.extend({ childCapabilityId: z.literal("observe-metric-like-count"), targetType: z.literal("metric_like_count") }).strict(),
  VisualTargetNonSuccessResultSchema.extend({ childCapabilityId: z.literal("observe-metric-like-count"), targetType: z.literal("metric_like_count"), targetNature: z.literal("metric") }).strict(),
]);