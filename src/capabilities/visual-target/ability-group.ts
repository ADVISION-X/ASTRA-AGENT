import type {
  ParsedVisualTargetAbilityInput,
  VisualTargetAbilityGroup,
  VisualTargetAbilityInput,
  VisualTargetAbilityResult,
  VisualTargetChildCapabilityId,
} from "./contract.js";
import type { VisualTargetClockPort } from "./ports/visual-target-clock-port.js";
import type { VisualTargetProfilePort } from "./ports/visual-target-profile-port.js";
import { VisualTargetAbilityResultSchema } from "./schema.js";
import { createVisualTargetCapabilityRegistry, listVisualTargetChildren } from "./registry.js";
import { createSystemVisualTargetClock } from "./runtime/visual-target-clock.js";
import { dispatchVisualTargetFailure } from "./runtime/visual-target-dispatch-failure.js";
import { parseVisualTargetAbilityInput } from "./runtime/visual-target-input-gate.js";

type CreateVisualTargetAbilityGroupInput = {
  clock?: VisualTargetClockPort;
  profilePort?: VisualTargetProfilePort;
};

export function createVisualTargetAbilityGroup(input: CreateVisualTargetAbilityGroupInput = {}): VisualTargetAbilityGroup {
  const registry = createVisualTargetCapabilityRegistry();
  const context = {
    clock: input.clock ?? createSystemVisualTargetClock(),
    profilePort: input.profilePort ?? null,
  };

  const executeById = async (childCapabilityId: VisualTargetChildCapabilityId, callInput: ParsedVisualTargetAbilityInput): Promise<VisualTargetAbilityResult> => {
    const capability = registry.get(childCapabilityId);
    if (!capability) {
      return dispatchVisualTargetFailure({
        rawInput: callInput,
        childCapabilityId,
        context,
        failureReason: "unknown_child_capability",
        statusMessage: `Visual Target child capability is not registered for ${childCapabilityId}.`,
      });
    }

    try {
      return VisualTargetAbilityResultSchema.parse(await capability.execute(callInput, context));
    } catch (error) {
      return dispatchVisualTargetFailure({
        rawInput: callInput,
        childCapabilityId,
        context,
        failureReason: "child_execution_failed",
        statusMessage: error instanceof Error ? error.message : "Visual Target child execution failed.",
      });
    }
  };

  return {
    listChildCapabilityIds() {
      return listVisualTargetChildren();
    },
    async execute(inputValue) {
      const parsed = parseVisualTargetAbilityInput(inputValue);
      if (!parsed.success) {
        return dispatchVisualTargetFailure({
          rawInput: inputValue,
          context,
          failureReason: "input_schema_invalid",
          statusMessage: "Visual Target rejected invalid input schema.",
        });
      }
      return executeById(parsed.data.childCapabilityId, parsed.data);
    },
  };
}