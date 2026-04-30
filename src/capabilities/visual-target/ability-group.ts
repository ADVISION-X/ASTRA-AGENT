import type {
  VisualTargetAbilityGroup,
  VisualTargetAbilityInput,
  VisualTargetAbilityResult,
} from "./contract.js";
import { VisualTargetAbilityResultSchema } from "./schema.js";
import { createVisualTargetCapabilityRegistry, listVisualTargetChildren } from "./registry.js";
import { dispatchParsedVisualTargetFailure, dispatchVisualTargetInvalidInputFailure } from "./runtime/visual-target-dispatch-failure.js";
import { parseVisualTargetAbilityInput } from "./runtime/visual-target-input-gate.js";
import type { VisualTargetRuntimeContext } from "./runtime/visual-target-runtime-context.js";

type CreateVisualTargetAbilityGroupInput = {
  runtimeContext: VisualTargetRuntimeContext;
};

export function createVisualTargetAbilityGroup(input: CreateVisualTargetAbilityGroupInput): VisualTargetAbilityGroup {
  const registry = createVisualTargetCapabilityRegistry();
  const context = input.runtimeContext;

  return {
    listChildCapabilityIds() {
      return listVisualTargetChildren();
    },
    async execute(inputValue) {
      const parsed = parseVisualTargetAbilityInput(inputValue);
      if (!parsed.success) {
        return dispatchVisualTargetInvalidInputFailure({
          rawInput: inputValue,
          clock: context.clock,
          parseError: parsed.error.message,
          statusMessage: "Visual Target rejected invalid input schema.",
        });
      }

      const capability = registry.get(parsed.data.childCapabilityId);
      if (!capability) {
        return dispatchParsedVisualTargetFailure({
          request: parsed.data,
          clock: context.clock,
          failureReason: "unknown_child_capability",
          statusMessage: `Visual Target child capability is not registered for ${parsed.data.childCapabilityId}.`,
        });
      }

      try {
        return VisualTargetAbilityResultSchema.parse(await capability.execute(parsed.data, context));
      } catch (error) {
        return dispatchParsedVisualTargetFailure({
          request: parsed.data,
          clock: context.clock,
          failureReason: "child_execution_failed",
          statusMessage: error instanceof Error ? error.message : "Visual Target child execution failed.",
        });
      }
    },
  };
}