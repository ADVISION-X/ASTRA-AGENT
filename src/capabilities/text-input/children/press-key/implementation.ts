import { TEXT_INPUT_ABILITY_GROUP_ID } from "../../contract.js";
import type { TextInputChildCapability } from "../../runtime/text-input-child-capability.js";
import { executeTextInput } from "../../runtime/text-input-executor.js";
import { PressKeyAbilityInputSchema } from "./schema.js";

export function createPressKeyCapability(): TextInputChildCapability {
  return {
    abilityGroupId: TEXT_INPUT_ABILITY_GROUP_ID,
    childCapabilityId: "press-key",
    async execute(input, context) {
      const parsedInput = PressKeyAbilityInputSchema.parse(input);
      return executeTextInput({ request: parsedInput, context });
    },
  };
}