import { TEXT_INPUT_ABILITY_GROUP_ID } from "../../contract.js";
import type { TextInputChildCapability } from "../../runtime/text-input-child-capability.js";
import { executeTextInput } from "../../runtime/text-input-executor.js";
import { PasteTextAbilityInputSchema } from "./schema.js";

export function createPasteTextCapability(): TextInputChildCapability {
  return {
    abilityGroupId: TEXT_INPUT_ABILITY_GROUP_ID,
    childCapabilityId: "paste-text",
    async execute(input, context) {
      const parsedInput = PasteTextAbilityInputSchema.parse(input);
      return executeTextInput({ request: parsedInput, context });
    },
  };
}