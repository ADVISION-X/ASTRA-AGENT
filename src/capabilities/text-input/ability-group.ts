import type { ParsedTextInputAbilityInput, TextInputAbilityGroup, TextInputChildCapabilityId } from "./contract.js";
import { TextInputAbilityResultSchema } from "./schema.js";
import { createTextInputCapabilityRegistry, listTextInputChildren } from "./registry.js";
import { dispatchTextInputFailure } from "./runtime/text-input-dispatch-failure.js";
import { parseTextInputAbilityInput } from "./runtime/text-input-input-gate.js";
import type { TextInputRuntimeContext } from "./runtime/text-input-runtime-context.js";

type CreateTextInputAbilityGroupInput = {
  context: TextInputRuntimeContext;
};

const executeTextInputChildCapability = async (
  registry: ReturnType<typeof createTextInputCapabilityRegistry>,
  context: TextInputRuntimeContext,
  childCapabilityId: TextInputChildCapabilityId,
  callInput: ParsedTextInputAbilityInput,
) => {
  const capability = registry.get(childCapabilityId);
  if (!capability) {
    return dispatchTextInputFailure({
      rawInput: callInput,
      context,
      childCapabilityId,
      failureReason: "unknown_child_capability",
      statusMessage: `Text Input child capability is not registered for ${childCapabilityId}.`,
    });
  }

  try {
    return TextInputAbilityResultSchema.parse(await capability.execute(callInput, context));
  } catch (error) {
    return dispatchTextInputFailure({
      rawInput: callInput,
      context,
      childCapabilityId,
      failureReason: "child_execution_failed",
      statusMessage: error instanceof Error ? error.message : "Text Input child execution failed.",
    });
  }
};

const executeTextInputAbilityInput = (
  registry: ReturnType<typeof createTextInputCapabilityRegistry>,
  context: TextInputRuntimeContext,
  inputValue: Parameters<TextInputAbilityGroup["execute"]>[0],
) => {
  const parsed = parseTextInputAbilityInput(inputValue);
  if (!parsed.success) {
    return dispatchTextInputFailure({
      rawInput: inputValue,
      context,
      failureReason: "input_schema_invalid",
      statusMessage: parsed.statusMessage,
    });
  }

  return executeTextInputChildCapability(registry, context, parsed.data.childCapabilityId, parsed.data);
};

export function createTextInputAbilityGroup(input: CreateTextInputAbilityGroupInput): TextInputAbilityGroup {
  const registry = createTextInputCapabilityRegistry();

  return {
    listChildCapabilityIds: () => listTextInputChildren(),
    execute: (inputValue) => executeTextInputAbilityInput(registry, input.context, inputValue),
  };
}