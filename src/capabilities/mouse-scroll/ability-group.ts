import type {
  MouseScrollAbilityGroup,
  MouseScrollAbilityInput,
  MouseScrollChildCapabilityId,
  NormalizedMouseScrollAbilityInput,
} from "./contract.js";
import { MOUSE_SCROLL_ABILITY_GROUP_ID } from "./contract.js";
import type { MouseScrollPrimitivePort } from "./primitive-port.js";
import { createMouseScrollCapabilityRegistry } from "./registry.js";
import { DEFAULT_MOUSE_SCROLL_SAFETY_POLICY, type MouseScrollSafetyPolicy } from "./shared/scroll-policy.js";

type CreateMouseScrollAbilityGroupInput = {
  primitivePort: MouseScrollPrimitivePort;
  defaultSafetyPolicy?: Partial<MouseScrollSafetyPolicy>;
};

function normalizeMouseScrollInput(
  input: MouseScrollAbilityInput,
  defaultSafetyPolicy: MouseScrollSafetyPolicy,
): NormalizedMouseScrollAbilityInput {
  return {
    ...input,
    abilityGroupId: MOUSE_SCROLL_ABILITY_GROUP_ID,
    safetyPolicy: {
      ...defaultSafetyPolicy,
      ...input.safetyPolicy,
      requireGeometryGuard: true,
    },
  };
}

export function createMouseScrollAbilityGroup(input: CreateMouseScrollAbilityGroupInput): MouseScrollAbilityGroup {
  const registry = createMouseScrollCapabilityRegistry();
  const context = { primitivePort: input.primitivePort };
  const defaultSafetyPolicy: MouseScrollSafetyPolicy = {
    ...DEFAULT_MOUSE_SCROLL_SAFETY_POLICY,
    ...input.defaultSafetyPolicy,
    requireGeometryGuard: true,
  };

  const executeById = async (childCapabilityId: MouseScrollChildCapabilityId, callInput: MouseScrollAbilityInput) => {
    const capability = registry.get(childCapabilityId);
    if (!capability) {
      throw new Error(`Mouse scroll child capability is not registered for ${childCapabilityId}`);
    }

    return capability.execute(normalizeMouseScrollInput(callInput, defaultSafetyPolicy), context);
  };

  return {
    listChildCapabilityIds() {
      return [...registry.keys()];
    },
    execute(inputValue) {
      return executeById(inputValue.childCapabilityId, inputValue);
    },
  };
}