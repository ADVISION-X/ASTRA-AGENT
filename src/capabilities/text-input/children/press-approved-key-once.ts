import { TEXT_INPUT_ABILITY_GROUP_ID } from "../shared/constants.js";
import type {
  TextInputChildCapability,
  TextInputExecutionContext,
  ParsedTextInputAbilityInput,
  TextInputAbilityResult,
} from "../contract.js";
import { executeTextInput } from "../runtime/execute-text-input.js";

export function createPressApprovedKeyOnceCapability(): TextInputChildCapability {
  return {
    abilityGroupId: TEXT_INPUT_ABILITY_GROUP_ID,
    childCapabilityId: "press-approved-key-once",
    writeMode: "press_key_once",
    async execute(
      input: ParsedTextInputAbilityInput,
      context: TextInputExecutionContext,
    ): Promise<TextInputAbilityResult> {
      return executeTextInput(input, "press_key_once", context);
    },
  };
}
