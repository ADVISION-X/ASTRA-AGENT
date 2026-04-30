import type { ParsedPostActionVerificationAbilityInput } from "../contract.js";
import type { PostActionEvidenceReadPort } from "../ports/post-action-evidence-read-port.js";
import type { PostActionVerificationClockPort } from "../ports/post-action-verification-clock-port.js";
import type { PostActionChildAssessmentSchema } from "../schema.js";
import type { POST_ACTION_VERIFICATION_ABILITY_GROUP_ID } from "../shared/post-action-types.js";
import type { z } from "zod";

export type PostActionChildAssessment = z.output<typeof PostActionChildAssessmentSchema>;

export type PostActionVerificationRuntimeContext = {
  clock: PostActionVerificationClockPort;
  evidenceReadPort: PostActionEvidenceReadPort;
};

export interface PostActionVerificationChildCapability {
  readonly abilityGroupId: typeof POST_ACTION_VERIFICATION_ABILITY_GROUP_ID;
  readonly childCapabilityId: ParsedPostActionVerificationAbilityInput["childCapabilityId"];

  execute(
    input: ParsedPostActionVerificationAbilityInput,
    context: PostActionVerificationRuntimeContext,
  ): Promise<PostActionChildAssessment>;
}