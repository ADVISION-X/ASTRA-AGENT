import type { ParsedTextInputAbilityInput, TextInputAbilityGroup, TextInputChildCapabilityId } from "./contract.js";
import { TextInputAbilityResultSchema } from "./schema.js";
import { createTextInputCapabilityRegistry, listTextInputChildren } from "./registry.js";
import { dispatchTextInputFailure } from "./runtime/text-input-dispatch-failure.js";
import { parseTextInputAbilityInput } from "./runtime/text-input-input-gate.js";
import type { TextInputRuntimeContext } from "./runtime/text-input-runtime-context.js";

type CreateTextInputAbilityGroupInput = {
  context: TextInputRuntimeContext;
};

export function createTextInputAbilityGroup(input: CreateTextInputAbilityGroupInput): TextInputAbilityGroup {
  const registry = createTextInputCapabilityRegistry();

  const executeById = async (childCapabilityId: TextInputChildCapabilityId, callInput: ParsedTextInputAbilityInput) => {
    const capability = registry.get(childCapabilityId);
    if (!capability) {
      return dispatchTextInputFailure({
        rawInput: callInput,
        context: input.context,
        childCapabilityId,
        failureReason: "unknown_child_capability",
        statusMessage: `Text Input child capability is not registered for ${childCapabilityId}.`,
      });
    }

    try {
      return TextInputAbilityResultSchema.parse(await capability.execute(callInput, input.context));
    } catch (error) {
      return dispatchTextInputFailure({
        rawInput: callInput,
        context: input.context,
        childCapabilityId,
        failureReason: "child_execution_failed",
        statusMessage: error instanceof Error ? error.message : "Text Input child execution failed.",
      });
    }
  };

  return {
    listChildCapabilityIds() {
      return listTextInputChildren();
    },
    async execute(inputValue) {
      const parsed = parseTextInputAbilityInput(inputValue);
      if (!parsed.success) {
        return dispatchTextInputFailure({
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