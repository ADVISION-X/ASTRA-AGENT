import { z } from "zod";

import { PostActionChildAssessmentSchema, PostActionVerificationAbilityInputSchema } from "../../schema.js";

export const VerifyTargetStateChangedInputSchema = PostActionVerificationAbilityInputSchema.extend({
  childCapabilityId: z.literal("verify-target-state-changed"),
  expectedOutcome: z.object({
    outcomeType: z.literal("target_state_changed"),
  }).passthrough(),
}).strict();

export const VerifyTargetStateChangedOutputSchema = PostActionChildAssessmentSchema;
