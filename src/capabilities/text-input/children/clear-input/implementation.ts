import { TEXT_INPUT_ABILITY_GROUP_ID } from "../../contract.js";
import type { TextInputChildCapability } from "../../runtime/text-input-child-capability.js";
import { executeTextInput } from "../../runtime/text-input-executor.js";
import { ClearInputAbilityInputSchema } from "./schema.js";

export function createClearInputCapability(): TextInputChildCapability {
  return {
    abilityGroupId: TEXT_INPUT_ABILITY_GROUP_ID,
    childCapabilityId: "clear-input",
    async execute(input, context) {
      const parsedInput = ClearInputAbilityInputSchema.parse(input);
      return executeTextInput({ request: parsedInput, context });
    },
  };
}