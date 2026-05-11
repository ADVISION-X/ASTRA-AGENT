import { TEXT_INPUT_ABILITY_GROUP_ID } from "../shared/constants.js";
import type {
  TextInputChildCapability,
  TextInputExecutionContext,
  ParsedTextInputAbilityInput,
  TextInputAbilityResult,
} from "../contract.js";
import { executeTextInput } from "../runtime/execute-text-input.js";

export function createClearFocusedInputOnceCapability(): TextInputChildCapability {
  return {
    abilityGroupId: TEXT_INPUT_ABILITY_GROUP_ID,
    childCapabilityId: "clear-focused-input-once",
    writeMode: "clear_focused_input_once",
    async execute(
      input: ParsedTextInputAbilityInput,
      context: TextInputExecutionContext,
    ): Promise<TextInputAbilityResult> {
      return executeTextInput(input, "clear_focused_input_once", context);
    },
  };
}
