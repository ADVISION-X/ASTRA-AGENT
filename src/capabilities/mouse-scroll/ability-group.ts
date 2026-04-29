import type {
  MouseScrollAbilityGroup,
  MouseScrollAbilityInput,
  MouseScrollChildCapabilityId,
  ParsedMouseScrollAbilityInput,
} from "./contract.js";
import type { MouseScrollClockPort } from "./ports/mouse-scroll-clock-port.js";
import type { MouseScrollPrimitivePort } from "./ports/mouse-scroll-primitive-port.js";
import { MouseScrollAbilityResultSchema } from "./schema.js";
import { createMouseScrollCapabilityRegistry, listMouseScrollChildren } from "./registry.js";
import { createSystemMouseScrollClock } from "./runtime/mouse-scroll-clock.js";
import { dispatchMouseScrollFailure } from "./runtime/mouse-scroll-dispatch-failure.js";
import { createMouseScrollIdempotencyRegistry, type MouseScrollIdempotencyRegistry } from "./runtime/mouse-scroll-idempotency.js";
import { parseMouseScrollAbilityInput } from "./runtime/mouse-scroll-input-gate.js";

type CreateMouseScrollAbilityGroupInput = {
  primitivePort: MouseScrollPrimitivePort;
  clock?: MouseScrollClockPort;
  idempotency?: MouseScrollIdempotencyRegistry;
};

export function createMouseScrollAbilityGroup(input: CreateMouseScrollAbilityGroupInput): MouseScrollAbilityGroup {
  const registry = createMouseScrollCapabilityRegistry();
  const context = {
    primitivePort: input.primitivePort,
    clock: input.clock ?? createSystemMouseScrollClock(),
    idempotency: input.idempotency ?? createMouseScrollIdempotencyRegistry(),
  };

  const executeById = async (childCapabilityId: MouseScrollChildCapabilityId, callInput: ParsedMouseScrollAbilityInput) => {
    const capability = registry.get(childCapabilityId);
    if (!capability) {
      return dispatchMouseScrollFailure({
        rawInput: callInput,
        context,
        childCapabilityId,
        failureReason: "unknown_child_capability",
        statusMessage: `Mouse Scroll child capability is not registered for ${childCapabilityId}.`,
      });
    }

    try {
      return MouseScrollAbilityResultSchema.parse(await capability.execute(callInput, context));
    } catch (error) {
      return dispatchMouseScrollFailure({
        rawInput: callInput,
        context,
        childCapabilityId,
        failureReason: "child_execution_failed",
        statusMessage: error instanceof Error ? error.message : "Mouse Scroll child execution failed.",
      });
    }
  };

  return {
    listChildCapabilityIds() {
      return listMouseScrollChildren();
    },
    async execute(inputValue) {
      const parsed = parseMouseScrollAbilityInput(inputValue);
      if (!parsed.success) {
        return dispatchMouseScrollFailure({
          rawInput: inputValue,
          context,
          failureReason: "input_schema_invalid",
          statusMessage: "Mouse Scroll rejected invalid input schema.",
        });
      }
      return executeById(parsed.data.childCapabilityId, parsed.data);
    },
  };
}