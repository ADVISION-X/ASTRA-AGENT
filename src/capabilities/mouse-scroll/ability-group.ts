import type {
  MouseScrollAbilityGroup,
  MouseScrollAbilityInput,
  MouseScrollChildCapabilityId,
  ParsedMouseScrollAbilityInput,
} from "./contract.js";
import { MouseScrollAbilityResultSchema } from "./schema.js";
import { createMouseScrollCapabilityRegistry, listMouseScrollChildren } from "./registry.js";
import { dispatchMouseScrollFailure } from "./runtime/mouse-scroll-dispatch-failure.js";
import { parseMouseScrollAbilityInput } from "./runtime/mouse-scroll-input-gate.js";
import type { MouseScrollExecutionContext } from "./runtime/mouse-scroll-runtime-context.js";

type CreateMouseScrollAbilityGroupInput = {
  context: MouseScrollExecutionContext;
};

const dispatchInvalidMouseScrollInput = (input: CreateMouseScrollAbilityGroupInput, inputValue: MouseScrollAbilityInput) =>
  dispatchMouseScrollFailure({
    rawInput: inputValue,
    context: input.context,
    failureReason: "input_schema_invalid",
    statusMessage: "Mouse Scroll rejected invalid input schema.",
  });

const executeMouseScrollChild = async (
  input: CreateMouseScrollAbilityGroupInput,
  registry: ReturnType<typeof createMouseScrollCapabilityRegistry>,
  childCapabilityId: MouseScrollChildCapabilityId,
  callInput: ParsedMouseScrollAbilityInput,
) => {
  const capability = registry.get(childCapabilityId);
  if (!capability) {
    return dispatchMouseScrollFailure({
      rawInput: callInput,
      context: input.context,
      childCapabilityId,
      failureReason: "unknown_child_capability",
      statusMessage: `Mouse Scroll child capability is not registered for ${childCapabilityId}.`,
    });
  }

  try {
    return MouseScrollAbilityResultSchema.parse(await capability.execute(callInput, input.context));
  } catch (error) {
    return dispatchMouseScrollFailure({
      rawInput: callInput,
      context: input.context,
      childCapabilityId,
      failureReason: "child_execution_failed",
      statusMessage: error instanceof Error ? error.message : "Mouse Scroll child execution failed.",
    });
  }
};

export function createMouseScrollAbilityGroup(input: CreateMouseScrollAbilityGroupInput): MouseScrollAbilityGroup {
  const registry = createMouseScrollCapabilityRegistry();

  return {
    listChildCapabilityIds() {
      return listMouseScrollChildren();
    },
    async execute(inputValue) {
      const parsed = parseMouseScrollAbilityInput(inputValue);
      if (!parsed.success) {
        return dispatchInvalidMouseScrollInput(input, inputValue);
      }
      return executeMouseScrollChild(input, registry, parsed.data.childCapabilityId, parsed.data);
    },
  };
}