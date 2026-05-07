import type { z } from "zod";

import type { PostActionVerificationClockPort } from "./ports/post-action-verification-clock-port.js";
import type { PostActionEvidenceReadPort } from "./ports/post-action-evidence-read-port.js";
import {
  PostActionActionProofSchema,
  PostActionEvidenceRefSchema,
  PostActionExpectedOutcomeSchema,
  PostActionObservationSchema,
  PostActionVerificationOutputSchema,
  PostActionRuntimeProofSchema,
  PostActionVerificationAbilityInputSchema,
  PostActionVerificationAbilityResultSchema,
  PostActionVerificationChildCapabilityIdSchema,
  PostActionVerificationPolicySchema,
  PostActionVerificationStatusSchema,
  PostActionFailureReasonSchema,
} from "./schema.js";
import { POST_ACTION_VERIFICATION_ABILITY_GROUP_ID, POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS } from "./shared/post-action-types.js";

export { POST_ACTION_VERIFICATION_ABILITY_GROUP_ID, POST_ACTION_VERIFICATION_CHILD_CAPABILITY_IDS };

type PostActionVerificationChildCapabilityId = z.output<typeof PostActionVerificationChildCapabilityIdSchema>;
type PostActionVerificationStatus = z.output<typeof PostActionVerificationStatusSchema>;
type PostActionFailureReason = z.output<typeof PostActionFailureReasonSchema>;
type PostActionActionProof = z.input<typeof PostActionActionProofSchema>;
type PostActionEvidenceRef = z.input<typeof PostActionEvidenceRefSchema>;
type PostActionExpectedOutcome = z.input<typeof PostActionExpectedOutcomeSchema>;
type PostActionObservation = z.input<typeof PostActionObservationSchema>;
type PostActionVerificationPolicy = z.input<typeof PostActionVerificationPolicySchema>;
type PostActionVerificationOutput = z.output<typeof PostActionVerificationOutputSchema>;
type PostActionRuntimeProof = z.output<typeof PostActionRuntimeProofSchema>;
type PostActionVerificationAbilityInput = z.input<typeof PostActionVerificationAbilityInputSchema>;
type ParsedPostActionVerificationAbilityInput = z.output<typeof PostActionVerificationAbilityInputSchema>;
type PostActionVerificationAbilityResult = z.output<typeof PostActionVerificationAbilityResultSchema>;

type CreatePostActionVerificationAbilityGroupInput = {
  clock: PostActionVerificationClockPort;
  evidenceReadPort: PostActionEvidenceReadPort;
};

interface PostActionVerificationAbilityGroup {
  listChildCapabilityIds(): PostActionVerificationChildCapabilityId[];
  execute(input: PostActionVerificationAbilityInput): Promise<PostActionVerificationAbilityResult>;
}


export type { PostActionVerificationChildCapabilityId, PostActionVerificationStatus, PostActionFailureReason, PostActionActionProof, PostActionEvidenceRef, PostActionExpectedOutcome, PostActionObservation, PostActionVerificationPolicy, PostActionVerificationOutput, PostActionRuntimeProof, PostActionVerificationAbilityInput, ParsedPostActionVerificationAbilityInput, PostActionVerificationAbilityResult, CreatePostActionVerificationAbilityGroupInput, PostActionVerificationAbilityGroup };
