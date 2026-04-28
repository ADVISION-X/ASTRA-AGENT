import type { MouseClickPrimitivePort } from "./primitive-port.js";
import {
  MOUSE_CLICK_ABILITY_GROUP_ID,
  type MouseClickAbilityGroup,
  type MouseClickAbilityInput,
  type MouseClickChildCapabilityId,
  type NormalizedMouseClickAbilityInput,
} from "./contract.js";
import { createMouseClickCapabilityRegistry } from "./registry.js";
import { DEFAULT_MOUSE_CLICK_SAFETY_POLICY, type MouseClickSafetyPolicy } from "./shared/click-policy.js";

type CreateMouseClickAbilityGroupInput = {
  primitivePort: MouseClickPrimitivePort;
  defaultSafetyPolicy?: Partial<MouseClickSafetyPolicy>;
};

function normalizeMouseClickInput(
  input: MouseClickAbilityInput,
  defaultSafetyPolicy: MouseClickSafetyPolicy,
): NormalizedMouseClickAbilityInput {
  return {
    ...input,
    abilityGroupId: MOUSE_CLICK_ABILITY_GROUP_ID,
    button: input.button ?? "left",
    clickCount: input.clickCount ?? 1,
    safetyPolicy: {
      ...defaultSafetyPolicy,
      ...input.safetyPolicy,
      requireGeometryGuard: true,
    },
  };
}

export function createMouseClickAbilityGroup(input: CreateMouseClickAbilityGroupInput): MouseClickAbilityGroup {
  const registry = createMouseClickCapabilityRegistry();
  const context = { primitivePort: input.primitivePort };
  const defaultSafetyPolicy: MouseClickSafetyPolicy = {
    ...DEFAULT_MOUSE_CLICK_SAFETY_POLICY,
    ...input.defaultSafetyPolicy,
    requireGeometryGuard: true,
  };

  const executeById = async (childCapabilityId: MouseClickChildCapabilityId, callInput: MouseClickAbilityInput) => {
    const capability = registry.get(childCapabilityId);
    if (!capability) {
      throw new Error(`Mouse click child capability is not registered for ${childCapabilityId}`);
    }

    return capability.execute(normalizeMouseClickInput(callInput, defaultSafetyPolicy), context);
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