import { type GeometryGuardAbilityGroup, type GeometryGuardAbilityInput, type GeometryGuardChildCapabilityId } from "./contract.js";
import { createGeometryGuardCapabilityRegistry } from "./registry.js";

type CallInput = Omit<GeometryGuardAbilityInput, "childCapabilityId">;

export function createGeometryGuardAbilityGroup(): GeometryGuardAbilityGroup {
  const registry = createGeometryGuardCapabilityRegistry();
  const context = {};

  const executeById = async (childCapabilityId: GeometryGuardChildCapabilityId, callInput: CallInput) => {
    const capability = registry.get(childCapabilityId);
    if (!capability) {
      throw new Error(`Geometry guard child capability is not registered for ${childCapabilityId}`);
    }

    return capability.execute({ childCapabilityId, ...callInput }, context);
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