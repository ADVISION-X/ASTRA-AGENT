import { z } from "zod";

import { VisualTargetAbilityInputSchema, VisualTargetAbilityResultSchema } from "../../schema.js";

export const ObserveNextVideoRegionInputSchema = VisualTargetAbilityInputSchema.extend({
  childCapabilityId: z.literal("observe-next-video-region"),
  targetType: z.literal("next_video_region"),
  targetNature: z.literal("region"),
}).strict();

export const ObserveNextVideoRegionResultSchema = VisualTargetAbilityResultSchema.superRefine((value, context) => {
  if (value.childCapabilityId !== "observe-next-video-region") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "observe-next-video-region result must keep childCapabilityId=observe-next-video-region", path: ["childCapabilityId"] });
  }
  if (value.targetType !== "next_video_region") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "observe-next-video-region result must keep targetType=next_video_region", path: ["targetType"] });
  }
  if (value.targetNature !== "region") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "observe-next-video-region result must keep targetNature=region", path: ["targetNature"] });
  }
});
