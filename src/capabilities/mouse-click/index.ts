import type { MouseClickPrimitivePort } from "./ports/mouse-click-primitive-port.js";
import { createMouseClickAbilityGroup } from "./ability-group.js";

export function createMouseClickAbilityGroupWithPrimitivePort(input: {
  primitivePort: MouseClickPrimitivePort;
}) {
  return createMouseClickAbilityGroup({
    context: { primitivePort: input.primitivePort },
  });
}

export { createMouseClickAbilityGroup } from "./ability-group.js";
export {
  MOUSE_CLICK_ABILITY_GROUP_ID,
  MOUSE_CLICK_CHILD_CAPABILITY_IDS,
  type MouseClickAbilityGroup,
  type MouseClickAbilityInput,
  type MouseClickAbilityResult,
  type MouseClickChildCapabilityId,
  type MouseClickExecutionContext,
  type MouseClickFailureReason,
  type MouseClickRuntimeProof,
  type MouseClickStatus,
  type ParsedMouseClickAbilityInput,
} from "./contract.js";
export {
  MouseClickAbilityInputSchema,
  MouseClickAbilityResultSchema,
  MouseClickChildCapabilityIdSchema,
  MouseClickRuntimeProofSchema,
  MouseClickStatusSchema,
} from "./schema.js";
export { listMouseClickChildren } from "./registry.js";
export type {
  MouseClickPrimitiveInput,
  MouseClickPrimitivePort,
  MouseClickPrimitiveResult,
} from "./ports/mouse-click-primitive-port.js";
