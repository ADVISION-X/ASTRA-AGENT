import { z } from "zod";

import { VisualTargetAbilityInputSchema, VisualTargetMetricSuccessResultSchema, VisualTargetNonSuccessResultSchema } from "../../schema.js";

export const DetectMetricLikeCountInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("detect-metric-like-count"),
  targetType: z.literal("metric_like_count"),
  targetNature: z.literal("metric"),
}).strict();

export const DetectMetricLikeCountResultSchema = z.union([
  VisualTargetMetricSuccessResultSchema.extend({ childCapabilityId: z.literal("detect-metric-like-count"), targetType: z.literal("metric_like_count") }).strict(),
  VisualTargetNonSuccessResultSchema.extend({ childCapabilityId: z.literal("detect-metric-like-count"), targetType: z.literal("metric_like_count"), targetNature: z.literal("metric") }).strict(),
]);