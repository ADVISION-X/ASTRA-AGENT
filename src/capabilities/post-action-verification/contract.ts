import type { z } from "zod";

import type { PostActionEvidenceReadPort } from "./ports/post-action-evidence-read-port.js";
import type { PostActionVerificationClockPort } from "./ports/post-action-verification-clock-port.js";
import {
  PostActionActionProofSchema,
  PostActionChildAssessmentSchema,
  PostActionConfidencePolicySchema,
  PostActionEvidenceRefSchema,
  PostActionExpectedOutcomeSchema,
  PostActionObservationSchema,
  PostActionRuntimeProofSchema,
  PostActionVerificationAbilityInputSchema,
  PostActionVerificationAbilityResultSchema,
  PostActionVerificationChildCapabilityIdSchema,
  PostActionVerificationDecisionSchema,
  PostActionVerificationPolicySchema,
  PostActionVerificationStatusSchema,
  PostActionFailureReasonSchema,
} from "./schema.js";
import { POST_ACTION_VERIFICATION_ABILITY_GROUP_ID, POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS } from "./shared/post-action-types.js";

export { POST_ACTION_VERIFICATION_ABILITY_GROUP_ID, POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS };

export type PostActionVerificationChildCapabilityId = z.output<typeof PostActionVerificationChildCapabilityIdSchema>;
export type PostActionVerificationDecision = z.output<typeof PostActionVerificationDecisionSchema>;
export type PostActionVerificationStatus = z.output<typeof PostActionVerificationStatusSchema>;
export type PostActionFailureReason = z.output<typeof PostActionFailureReasonSchema>;
export type PostActionActionProof = z.output<typeof PostActionActionProofSchema>;
export type PostActionEvidenceRef = z.output<typeof PostActionEvidenceRefSchema>;
export type PostActionExpectedOutcome = z.output<typeof PostActionExpectedOutcomeSchema>;
export type PostActionObservation = z.output<typeof PostActionObservationSchema>;
export type PostActionVerificationPolicy = z.output<typeof PostActionVerificationPolicySchema>;
export type PostActionConfidencePolicy = z.output<typeof PostActionConfidencePolicySchema>;
export type PostActionRuntimeProof = z.output<typeof PostActionRuntimeProofSchema>;
export type PostActionChildAssessment = z.output<typeof PostActionChildAssessmentSchema>;
export type PostActionVerificationAbilityInput = z.input<typeof PostActionVerificationAbilityInputSchema>;
export type ParsedPostActionVerificationAbilityInput = z.output<typeof PostActionVerificationAbilityInputSchema>;
export type PostActionVerificationAbilityResult = z.output<typeof PostActionVerificationAbilityResultSchema>;

export type PostActionVerificationAbilityContext = {
  clock: PostActionVerificationClockPort;
  evidenceReadPort: PostActionEvidenceReadPort;
};

export interface PostActionVerificationChildCapability {
  readonly abilityGroupId: typeof POST_ACTION_VERIFICATION_ABILITY_GROUP_ID;
  readonly childCapabilityId: PostActionVerificationChildCapabilityId;

  execute(
    input: ParsedPostActionVerificationAbilityInput,
    context: PostActionVerificationAbilityContext,
  ): Promise<PostActionChildAssessment>;
}

export interface PostActionVerificationAbilityGroup {
  listChildCapabilityIds(): PostActionVerificationChildCapabilityId[];
  execute(input: PostActionVerificationAbilityInput): Promise<PostActionVerificationAbilityResult>;
}
