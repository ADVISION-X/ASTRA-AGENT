import type { GeometryGuardAbilityGroup, GeometryGuardAbilityInput } from "./contract.js";
import { GeometryGuardAbilityInputSchema } from "./schema.js";
import { createGeometryGuardCapabilityRegistry } from "./registry.js";
import { buildInputSchemaInvalidResult } from "./runtime/result.js";

export function createGeometryGuardAbilityGroup(): GeometryGuardAbilityGroup {
  const registry = createGeometryGuardCapabilityRegistry();

  return {
    listChildCapabilityIds() {
      return [...registry.keys()];
    },

    async execute(inputValue: GeometryGuardAbilityInput) {
      const startedAt = new Date().toISOString();
      const startMs = Date.now();

      const parsedInput = GeometryGuardAbilityInputSchema.safeParse(inputValue);
      if (!parsedInput.success) {
        const endedAt = new Date().toISOString();
        return buildInputSchemaInvalidResult(
          inputValue,
          startedAt,
          endedAt,
          Date.now() - startMs,
        );
      }

      const capability = registry.get(parsedInput.data.childCapabilityId);
      if (!capability) {
        const endedAt = new Date().toISOString();
        return buildInputSchemaInvalidResult(
          inputValue,
          startedAt,
          endedAt,
          Date.now() - startMs,
        );
      }

      return capability.execute(parsedInput.data);
    },
  };
}
