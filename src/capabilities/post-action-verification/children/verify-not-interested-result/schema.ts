import { z } from "zod";

import { PostActionChildAssessmentSchema, PostActionVerificationAbilityInputSchema } from "../../schema.js";

export const VerifyNotInterestedResultInputSchema = PostActionVerificationAbilityInputSchema.extend({
  childCapabilityId: z.literal("verify-not-interested-result"),
  expectedOutcome: z.object({
    outcomeType: z.literal("not_interested_result"),
  }).passthrough(),
}).strict();

export const VerifyNotInterestedResultOutputSchema = PostActionChildAssessmentSchema;
