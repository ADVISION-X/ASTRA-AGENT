import { z } from "zod";

import { PostActionChildAssessmentSchema, PostActionVerificationAbilityInputSchema } from "../../schema.js";

export const VerifyVideoChangedAfterScrollInputSchema = PostActionVerificationAbilityInputSchema.extend({
  childCapabilityId: z.literal("verify-video-changed-after-scroll"),
  expectedOutcome: z.object({
    outcomeType: z.literal("video_changed_after_scroll"),
  }).passthrough(),
}).strict();

export const VerifyVideoChangedAfterScrollOutputSchema = PostActionChildAssessmentSchema;
