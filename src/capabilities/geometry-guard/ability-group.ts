import type { GeometryGuardAbilityGroup, GeometryGuardAbilityInput } from "./contract.js";
import { GeometryGuardAbilityInputSchema } from "./schema.js";
import { createSystemGeometryClock } from "./runtime/geometry-clock.js";
import { dispatchGeometryGuardFailure } from "./runtime/geometry-dispatch-failure.js";
import { coerceGeometryGuardFailureInput } from "./runtime/geometry-input-gate.js";
import { createGeometryGuardCapabilityRegistry } from "./registry.js";

export function createGeometryGuardAbilityGroup(): GeometryGuardAbilityGroup {
  const registry = createGeometryGuardCapabilityRegistry();
  const context = {
    clock: createSystemGeometryClock(),
  };

  return {
    listChildCapabilityIds() {
      return [...registry.keys()];
    },
    async execute(inputValue: GeometryGuardAbilityInput) {
      const parsedInput = GeometryGuardAbilityInputSchema.safeParse(inputValue);
      if (!parsedInput.success) {
        return dispatchGeometryGuardFailure({
          input: coerceGeometryGuardFailureInput(inputValue),
          context,
          failureReason: "input_schema_invalid",
          status: "failed",
          statusMessage: "Geometry Guard rejected invalid input schema.",
        });
      }

      const capability = registry.get(parsedInput.data.childCapabilityId);
      if (!capability) {
        return dispatchGeometryGuardFailure({
          input: parsedInput.data,
          context,
          failureReason: "unknown_child_capability",
          status: "failed",
          statusMessage: `Geometry Guard child capability is not registered for ${parsedInput.data.childCapabilityId}.`,
        });
      }

      return capability.execute(parsedInput.data, context);
    },
  };
}