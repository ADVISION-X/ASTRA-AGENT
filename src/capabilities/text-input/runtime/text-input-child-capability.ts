import type { ParsedTextInputAbilityInput, TextInputAbilityResult, TextInputChildCapabilityId } from "../contract.js";
import { TEXT_INPUT_ABILITY_GROUP_ID } from "../contract.js";
import type { TextInputRuntimeContext } from "./text-input-runtime-context.js";

export interface TextInputChildCapability {
  readonly abilityGroupId: typeof TEXT_INPUT_ABILITY_GROUP_ID;
  readonly childCapabilityId: TextInputChildCapabilityId;
  execute(input: ParsedTextInputAbilityInput, context: TextInputRuntimeContext): Promise<TextInputAbilityResult>;
}