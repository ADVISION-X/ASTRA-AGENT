import { TEXT_INPUT_ABILITY_GROUP_ID } from "../../contract.js";
import type { TextInputChildCapability } from "../../runtime/text-input-child-capability.js";
import { executeTextInput } from "../../runtime/text-input-executor.js";
import { TypeTextAbilityInputSchema } from "./schema.js";

export function createTypeTextCapability(): TextInputChildCapability {
  return {
    abilityGroupId: TEXT_INPUT_ABILITY_GROUP_ID,
    childCapabilityId: "type-text",
    async execute(input, context) {
      const parsedInput = TypeTextAbilityInputSchema.parse(input);
      return executeTextInput({ request: parsedInput, context });
    },
  };
}