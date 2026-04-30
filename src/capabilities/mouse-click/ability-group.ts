import { MouseClickAbilityResultSchema } from "./schema.js";
import { type MouseClickAbilityContext, type MouseClickAbilityGroup, type MouseClickAbilityInput, type MouseClickChildCapabilityId, type ParsedMouseClickAbilityInput } from "./contract.js";
import { createMouseClickCapabilityRegistry, listMouseClickChildren } from "./registry.js";
import { dispatchMouseClickFailure } from "./runtime/mouse-click-dispatch-failure.js";
import { parseMouseClickAbilityInput } from "./runtime/mouse-click-input-gate.js";

type CreateMouseClickAbilityGroupInput = {
  context: MouseClickAbilityContext;
};

const dispatchInvalidMouseClickInput = (input: CreateMouseClickAbilityGroupInput, inputValue: MouseClickAbilityInput, statusMessage: string) =>
  dispatchMouseClickFailure({
    rawInput: inputValue,
    context: input.context,
    failureReason: "input_schema_invalid",
    statusMessage,
  });

const executeMouseClickChild = async (
  input: CreateMouseClickAbilityGroupInput,
  registry: ReturnType<typeof createMouseClickCapabilityRegistry>,
  childCapabilityId: MouseClickChildCapabilityId,
  callInput: ParsedMouseClickAbilityInput,
) => {
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

export function createMouseClickAbilityGroup(input: CreateMouseClickAbilityGroupInput): MouseClickAbilityGroup {
  const registry = createMouseClickCapabilityRegistry();

  return {
    listChildCapabilityIds() {
      return listMouseClickChildren();
    },
    async execute(inputValue) {
      const parsed = parseMouseClickAbilityInput(inputValue);
      if (!parsed.success) {
        return dispatchInvalidMouseClickInput(input, inputValue, parsed.statusMessage);
      }
      return executeMouseClickChild(input, registry, parsed.data.childCapabilityId, parsed.data);
    },
  };
}