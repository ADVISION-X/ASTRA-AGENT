import type {
  PageStateAbilityGroup,
  PageStateAbilityInput,
  PageStateChildCapabilityId,
} from "./contract.js";
import { PageStateAbilityInputSchema } from "./contract.js";
import { createPageStateRegistry } from "./registry.js";

type CallInput = Omit<PageStateAbilityInput, "childCapabilityId">;

export function createPageStateAbilityGroup(): PageStateAbilityGroup {
  const registry = createPageStateRegistry();

  const executeById = async (childCapabilityId: PageStateChildCapabilityId, callInput: CallInput) => {
    const capability = registry.get(childCapabilityId);
    if (!capability) {
      throw new Error(`Page-state child capability is not registered for ${childCapabilityId}`);
    }

    return capability.execute(PageStateAbilityInputSchema.parse({ childCapabilityId, ...callInput }));
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