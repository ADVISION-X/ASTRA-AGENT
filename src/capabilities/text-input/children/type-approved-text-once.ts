import { TEXT_INPUT_ABILITY_GROUP_ID } from "../shared/constants.js";
import type {
  TextInputChildCapability,
  TextInputExecutionContext,
  ParsedTextInputAbilityInput,
  TextInputAbilityResult,
} from "../contract.js";
import { executeTextInput } from "../runtime/execute-text-input.js";

export function createTypeApprovedTextOnceCapability(): TextInputChildCapability {
  return {
    abilityGroupId: TEXT_INPUT_ABILITY_GROUP_ID,
    childCapabilityId: "type-approved-text-once",
    writeMode: "type_text_once",
    async execute(
      input: ParsedTextInputAbilityInput,
      context: TextInputExecutionContext,
    ): Promise<TextInputAbilityResult> {
      return executeTextInput(input, "type_text_once", context);
    },
  };
}
