import type { z } from "zod";

import type { PostActionVerificationClockPort } from "./ports/post-action-verification-clock-port.js";
import type { PostActionEvidenceReadPort } from "./ports/post-action-evidence-read-port.js";
import {
  PostActionActionProofSchema,
  PostActionConfidencePolicySchema,
  PostActionEvidenceRefSchema,
  PostActionExpectedOutcomeSchema,
  PostActionObservationSchema,
  PostActionVerificationOutputSchema,
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
export type PostActionActionProof = z.input<typeof PostActionActionProofSchema>;
export type PostActionEvidenceRef = z.input<typeof PostActionEvidenceRefSchema>;
export type PostActionExpectedOutcome = z.input<typeof PostActionExpectedOutcomeSchema>;
export type PostActionObservation = z.input<typeof PostActionObservationSchema>;
export type PostActionVerificationPolicy = z.input<typeof PostActionVerificationPolicySchema>;
export type PostActionConfidencePolicy = z.input<typeof PostActionConfidencePolicySchema>;
export type PostActionVerificationOutput = z.output<typeof PostActionVerificationOutputSchema>;
export type PostActionRuntimeProof = z.output<typeof PostActionRuntimeProofSchema>;
export type PostActionVerificationAbilityInput = z.input<typeof PostActionVerificationAbilityInputSchema>;
export type ParsedPostActionVerificationAbilityInput = z.output<typeof PostActionVerificationAbilityInputSchema>;
export type PostActionVerificationAbilityResult = z.output<typeof PostActionVerificationAbilityResultSchema>;

export type CreatePostActionVerificationAbilityGroupInput = {
  clock: PostActionVerificationClockPort;
  evidenceReadPort: PostActionEvidenceReadPort;
};

export interface PostActionVerificationAbilityGroup {
  listChildCapabilityIds(): PostActionVerificationChildCapabilityId[];
  execute(input: PostActionVerificationAbilityInput): Promise<PostActionVerificationAbilityResult>;
}
