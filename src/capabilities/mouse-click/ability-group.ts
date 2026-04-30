import { MouseClickAbilityResultSchema } from "./schema.js";
import { type MouseClickAbilityContext, type MouseClickAbilityGroup, type MouseClickAbilityInput, type MouseClickChildCapabilityId, type ParsedMouseClickAbilityInput } from "./contract.js";
import { createMouseClickCapabilityRegistry, listMouseClickChildren } from "./registry.js";
import { dispatchMouseClickFailure } from "./runtime/mouse-click-dispatch-failure.js";
import { parseMouseClickAbilityInput } from "./runtime/mouse-click-input-gate.js";

type CreateMouseClickAbilityGroupInput = {
  context: MouseClickAbilityContext;
};

export function createMouseClickAbilityGroup(input: CreateMouseClickAbilityGroupInput): MouseClickAbilityGroup {
  const registry = createMouseClickCapabilityRegistry();

  const executeById = async (childCapabilityId: MouseClickChildCapabilityId, callInput: ParsedMouseClickAbilityInput) => {
    const capability = registry.get(childCapabilityId);
    if (!capability) {
      return dispatchMouseClickFailure({
        rawInput: callInput,
        context: input.context,
        childCapabilityId,
        failureReason: "unknown_child_capability",
        statusMessage: `Mouse Click child capability is not registered for ${childCapabilityId}.`,
      });
    }

    try {
      return MouseClickAbilityResultSchema.parse(await capability.execute(callInput, input.context));
    } catch (error) {
      return dispatchMouseClickFailure({
        rawInput: callInput,
        context: input.context,
        childCapabilityId,
        failureReason: "child_execution_failed",
        statusMessage: error instanceof Error ? error.message : "Mouse Click child execution failed.",
      });
    }
  };

  return {
    listChildCapabilityIds() {
      return listMouseClickChildren();
    },
    async execute(inputValue) {
      const parsed = parseMouseClickAbilityInput(inputValue);
      if (!parsed.success) {
        return dispatchMouseClickFailure({
          rawInput: inputValue,
          context: input.context,
          failureReason: "input_schema_invalid",
          statusMessage: parsed.statusMessage,
        });
      }
      return executeById(parsed.data.childCapabilityId, parsed.data);
    },
  };
}