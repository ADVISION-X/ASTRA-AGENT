import { z } from "zod";

import { PostActionChildAssessmentSchema, PostActionVerificationAbilityInputSchema } from "../../schema.js";

export const VerifyCommentsPanelClosedInputSchema = PostActionVerificationAbilityInputSchema.extend({
  childCapabilityId: z.literal("verify-comments-panel-closed"),
  expectedOutcome: z.object({
    outcomeType: z.literal("comments_panel_closed"),
  }).passthrough(),
}).strict();

export const VerifyCommentsPanelClosedOutputSchema = PostActionChildAssessmentSchema;
