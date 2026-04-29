import type { PostActionEvidenceReadPort } from "./ports/post-action-evidence-read-port.js";
import type { PostActionVerificationClockPort } from "./ports/post-action-verification-clock-port.js";
import { type PostActionVerificationAbilityGroup, type PostActionVerificationAbilityInput, type PostActionVerificationChildCapabilityId, type ParsedPostActionVerificationAbilityInput } from "./contract.js";
import { PostActionVerificationAbilityResultSchema, PostActionVerificationAbilityInputSchema } from "./schema.js";
import { createPostActionVerificationRegistry, listPostActionVerificationChildren } from "./registry.js";
import { executePostActionVerification } from "./runtime/post-action-verification-executor.js";
import { createSystemPostActionVerificationClock } from "./runtime/verification-clock.js";
import { dispatchPostActionVerificationFailure } from "./runtime/verification-dispatch-failure.js";

type CreatePostActionVerificationAbilityGroupInput = {
  clock?: PostActionVerificationClockPort;
  evidenceReadPort?: PostActionEvidenceReadPort;
};

function createInlinePostActionEvidenceReadPort(): PostActionEvidenceReadPort {
  return {
    listObservations(request) {
      return request.observationSet.observations;
    },
    getObservationByRef(request, ref) {
      return request.observationSet.observations.find((observation) => observation.ref === ref) ?? null;
    },
  };
}

export function createPostActionVerificationAbilityGroup(input: CreatePostActionVerificationAbilityGroupInput = {}): PostActionVerificationAbilityGroup {
  const registry = createPostActionVerificationRegistry();
  const context = {
    clock: input.clock ?? createSystemPostActionVerificationClock(),
    evidenceReadPort: input.evidenceReadPort ?? createInlinePostActionEvidenceReadPort(),
  };

  const executeById = async (childCapabilityId: PostActionVerificationChildCapabilityId, callInput: ParsedPostActionVerificationAbilityInput) => {
    const capability = registry.get(childCapabilityId);
    if (!capability) {
      return dispatchPostActionVerificationFailure({
        rawInput: callInput,
        context,
        childCapabilityId,
        status: "blocked",
        failureReason: "unknown_child_capability",
        statusMessage: `Post Action Verification child capability is not registered for ${childCapabilityId}.`,
      });
    }

    try {
      return PostActionVerificationAbilityResultSchema.parse(await executePostActionVerification({
        request: callInput,
        context,
        capability,
      }));
    } catch (error) {
      return dispatchPostActionVerificationFailure({
        rawInput: callInput,
        context,
        childCapabilityId,
        failureReason: "child_execution_failed",
        statusMessage: error instanceof Error ? error.message : "Post Action Verification child execution failed.",
      });
    }
  };

  return {
    listChildCapabilityIds() {
      return listPostActionVerificationChildren();
    },
    async execute(inputValue: PostActionVerificationAbilityInput) {
      const parsed = PostActionVerificationAbilityInputSchema.safeParse(inputValue);
      if (!parsed.success) {
        return dispatchPostActionVerificationFailure({
          rawInput: inputValue,
          context,
          status: "blocked",
          failureReason: "input_schema_invalid",
          statusMessage: "Post Action Verification rejected invalid input schema.",
        });
      }
      return executeById(parsed.data.childCapabilityId, parsed.data);
    },
  };
}
