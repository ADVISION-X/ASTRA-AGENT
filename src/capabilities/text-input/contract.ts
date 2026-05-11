import type { z } from "zod";

import {
  TEXT_INPUT_ABILITY_GROUP_ID,
  TEXT_INPUT_CHILD_CAPABILITY_IDS,
  type TextInputChildCapabilityId,
} from "./shared/constants.js";
import {
  TextInputAbilityInputSchema,
  TextInputAbilityResultSchema,
  TextInputChildCapabilityIdSchema,
  TextInputFailureReasonSchema,
  TextInputRuntimeProofSchema,
  TextInputStatusSchema,
  TextInputWriteModeSchema,
} from "./schema.js";

export { TEXT_INPUT_ABILITY_GROUP_ID, TEXT_INPUT_CHILD_CAPABILITY_IDS };
export type { TextInputChildCapabilityId };

export type TextInputAbilityInput = z.input<typeof TextInputAbilityInputSchema>;
export type ParsedTextInputAbilityInput = z.output<
  typeof TextInputAbilityInputSchema
>;
export type TextInputAbilityResult = z.output<
  typeof TextInputAbilityResultSchema
>;
export type TextInputStatus = z.output<typeof TextInputStatusSchema>;
export type TextInputFailureReason = z.output<
  typeof TextInputFailureReasonSchema
>;
export type TextInputRuntimeProof = z.output<typeof TextInputRuntimeProofSchema>;
export type TextInputWriteMode = z.output<typeof TextInputWriteModeSchema>;

export interface TextInputAbilityGroup {
  listChildCapabilityIds(): TextInputChildCapabilityId[];
  execute(input: TextInputAbilityInput): Promise<TextInputAbilityResult>;
}

export type TextInputExecutionContext = {
  primitivePort: import("./ports/text-input-primitive-port.js").TextInputPrimitivePort;
};

export interface TextInputChildCapability {
  readonly abilityGroupId: "text-input";
  readonly childCapabilityId: TextInputChildCapabilityId;
  readonly writeMode: TextInputWriteMode;
  execute(
    input: ParsedTextInputAbilityInput,
    context: TextInputExecutionContext,
  ): Promise<TextInputAbilityResult>;
}
