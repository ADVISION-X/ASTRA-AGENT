import type {
  PostActionVerificationAbilityGroup,
  PostActionVerificationAbilityInput,
  PostActionVerificationChildCapabilityId,
} from "./contract.js";
import { PostActionVerificationAbilityInputSchema } from "./contract.js";
import { createPostActionVerificationRegistry } from "./registry.js";

type CallInput = Omit<PostActionVerificationAbilityInput, "childCapabilityId">;

export function createPostActionVerificationAbilityGroup(): PostActionVerificationAbilityGroup {
  const registry = createPostActionVerificationRegistry();

  const executeById = async (childCapabilityId: PostActionVerificationChildCapabilityId, callInput: CallInput) => {
    const capability = registry.get(childCapabilityId);
    if (!capability) {
      throw new Error(`Post-action verification child capability is not registered for ${childCapabilityId}`);
    }

    return capability.execute(PostActionVerificationAbilityInputSchema.parse({ childCapabilityId, ...callInput }));
  };

  return {
    listChildCapabilityIds() {
      return [...registry.keys()];
    },
    execute(input) {
      return executeById(input.childCapabilityId, input);
    },
  };
}