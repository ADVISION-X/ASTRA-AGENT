import { z } from "zod";

import { PostActionChildAssessmentSchema, PostActionVerificationAbilityInputSchema } from "../../schema.js";

export const VerifyPageOpenedInputSchema = PostActionVerificationAbilityInputSchema.extend({
  childCapabilityId: z.literal("verify-page-opened"),
  expectedOutcome: z.object({
    outcomeType: z.literal("page_opened"),
  }).passthrough(),
}).strict();

export const VerifyPageOpenedOutputSchema = PostActionChildAssessmentSchema;
