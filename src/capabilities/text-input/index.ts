import type { TextInputPrimitivePort } from "./ports/text-input-primitive-port.js";
import { createTextInputAbilityGroup } from "./ability-group.js";

export function createTextInputAbilityGroupWithPrimitivePort(input: {
  primitivePort: TextInputPrimitivePort;
}) {
  return createTextInputAbilityGroup({
    context: { primitivePort: input.primitivePort },
  });
}

/** @deprecated Use createTextInputAbilityGroupWithPrimitivePort. Ports wrapper for workbench compatibility. */
export function createTextInputAbilityGroupWithPorts(input: {
  primitivePort: TextInputPrimitivePort;
  [key: string]: unknown;
}) {
  return createTextInputAbilityGroupWithPrimitivePort({ primitivePort: input.primitivePort });
}

export { createTextInputAbilityGroup } from "./ability-group.js";
export {
  TEXT_INPUT_ABILITY_GROUP_ID,
  TEXT_INPUT_CHILD_CAPABILITY_IDS,
  type TextInputChildCapabilityId,
} from "./shared/constants.js";
export {
  type TextInputAbilityGroup,
  type TextInputAbilityInput,
  type TextInputAbilityResult,
  type TextInputChildCapability,
  type TextInputExecutionContext,
  type TextInputFailureReason,
  type TextInputRuntimeProof,
  type TextInputStatus,
  type TextInputWriteMode,
  type ParsedTextInputAbilityInput,
} from "./contract.js";
export {
  TextInputAbilityInputSchema,
  TextInputAbilityResultSchema,
  TextInputChildCapabilityIdSchema,
  TextInputRuntimeProofSchema,
} from "./schema.js";
export type { TextInputPrimitivePort } from "./ports/text-input-primitive-port.js";
