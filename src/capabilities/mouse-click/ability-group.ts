import type { MouseClickClockPort } from "./ports/mouse-click-clock-port.js";
import type { MouseClickPrimitivePort } from "./ports/mouse-click-primitive-port.js";
import { MouseClickAbilityResultSchema } from "./schema.js";
import { type MouseClickAbilityGroup, type MouseClickAbilityInput, type MouseClickChildCapabilityId, type ParsedMouseClickAbilityInput } from "./contract.js";
import { createMouseClickCapabilityRegistry, listMouseClickChildren } from "./registry.js";
import { createSystemMouseClickClock } from "./runtime/mouse-click-clock.js";
import { dispatchMouseClickFailure } from "./runtime/mouse-click-dispatch-failure.js";
import { createMouseClickIdempotencyRegistry, type MouseClickIdempotencyRegistry } from "./runtime/mouse-click-idempotency.js";
import { parseMouseClickAbilityInput } from "./runtime/mouse-click-input-gate.js";

type CreateMouseClickAbilityGroupInput = {
  primitivePort: MouseClickPrimitivePort;
  clock?: MouseClickClockPort;
  idempotency?: MouseClickIdempotencyRegistry;
};

export function createMouseClickAbilityGroup(input: CreateMouseClickAbilityGroupInput): MouseClickAbilityGroup {
  const registry = createMouseClickCapabilityRegistry();
  const context = {
    primitivePort: input.primitivePort,
    clock: input.clock ?? createSystemMouseClickClock(),
    idempotency: input.idempotency ?? createMouseClickIdempotencyRegistry(),
  };

  const executeById = async (childCapabilityId: MouseClickChildCapabilityId, callInput: ParsedMouseClickAbilityInput) => {
    const capability = registry.get(childCapabilityId);
    if (!capability) {
      return dispatchMouseClickFailure({
        rawInput: callInput,
        context,
        childCapabilityId,
        failureReason: "unknown_child_capability",
        statusMessage: `Mouse Click child capability is not registered for ${childCapabilityId}.`,
      });
    }

    try {
      return MouseClickAbilityResultSchema.parse(await capability.execute(callInput, context));
    } catch (error) {
      return dispatchMouseClickFailure({
        rawInput: callInput,
        context,
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
          context,
          failureReason: "input_schema_invalid",
          statusMessage: "Mouse Click rejected invalid input schema.",
        });
      }
      return executeById(parsed.data.childCapabilityId, parsed.data);
    },
  };
}