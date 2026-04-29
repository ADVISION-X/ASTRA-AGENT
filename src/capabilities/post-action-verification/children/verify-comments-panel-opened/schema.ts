import { z } from "zod";

import { PostActionChildAssessmentSchema, PostActionVerificationAbilityInputSchema } from "../../schema.js";

export const VerifyCommentsPanelOpenedInputSchema = PostActionVerificationAbilityInputSchema.extend({
  childCapabilityId: z.literal("verify-comments-panel-opened"),
  expectedOutcome: z.object({
    outcomeType: z.literal("comments_panel_opened"),
  }).passthrough(),
}).strict();

export const VerifyCommentsPanelOpenedOutputSchema = PostActionChildAssessmentSchema;
