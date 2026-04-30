import { TEXT_INPUT_ABILITY_GROUP_ID } from "../../contract.js";
import type { TextInputChildCapability } from "../../runtime/text-input-child-capability.js";
import { executeTextInput } from "../../runtime/text-input-executor.js";
import { ReplaceInputAbilityInputSchema } from "./schema.js";

export function createReplaceInputCapability(): TextInputChildCapability {
  return {
    abilityGroupId: TEXT_INPUT_ABILITY_GROUP_ID,
    childCapabilityId: "replace-input",
    async execute(input, context) {
      const parsedInput = ReplaceInputAbilityInputSchema.parse(input);
      return executeTextInput({ request: parsedInput, context });
    },
  };
}