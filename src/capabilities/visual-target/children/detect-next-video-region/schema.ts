import { z } from "zod";

import { VisualTargetAbilityInputSchema, VisualTargetNonSuccessResultSchema, VisualTargetRegionSuccessResultSchema } from "../../schema.js";

export const DetectNextVideoRegionInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("detect-next-video-region"),
  targetType: z.literal("next_video_region"),
  targetNature: z.literal("region"),
}).strict();

export const DetectNextVideoRegionResultSchema = z.union([
  VisualTargetRegionSuccessResultSchema.extend({ childCapabilityId: z.literal("detect-next-video-region"), targetType: z.literal("next_video_region") }).strict(),
  VisualTargetNonSuccessResultSchema.extend({ childCapabilityId: z.literal("detect-next-video-region"), targetType: z.literal("next_video_region"), targetNature: z.literal("region") }).strict(),
]);