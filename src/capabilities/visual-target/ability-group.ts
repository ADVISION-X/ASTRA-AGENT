import type {
  VisualTargetAbilityGroup,
  VisualTargetAbilityInput,
} from "./contract.js";
import { VisualTargetAbilityInputSchema } from "./schema.js";
import { createVisualTargetCapabilityRegistry } from "./registry.js";
import { buildVisualTargetInputInvalidResult } from "./runtime/result.js";

export function createVisualTargetAbilityGroup(): VisualTargetAbilityGroup {
  const registry = createVisualTargetCapabilityRegistry();

  return {
    listChildCapabilityIds() {
      return [...registry.keys()];
    },

    async execute(inputValue: VisualTargetAbilityInput) {
      const startedAt = new Date().toISOString();
      const startMs = Date.now();

      const parsed = VisualTargetAbilityInputSchema.safeParse(inputValue);
      if (!parsed.success) {
        const endedAt = new Date().toISOString();
        return buildVisualTargetInputInvalidResult(
          inputValue,
          startedAt,
          endedAt,
          Date.now() - startMs,
        );
      }

      const capability = registry.get(parsed.data.childCapabilityId);
      if (!capability) {
        const endedAt = new Date().toISOString();
        return buildVisualTargetInputInvalidResult(
          inputValue,
          startedAt,
          endedAt,
          Date.now() - startMs,
        );
      }

      return capability.execute(parsed.data);
    },
  };
}
