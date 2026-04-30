import { TEXT_INPUT_ABILITY_GROUP_ID } from "../../contract.js";
import type { TextInputChildCapability } from "../../runtime/text-input-child-capability.js";
import { executeTextInput } from "../../runtime/text-input-executor.js";
import { CommitInputAbilityInputSchema } from "./schema.js";

export function createCommitInputCapability(): TextInputChildCapability {
  return {
    abilityGroupId: TEXT_INPUT_ABILITY_GROUP_ID,
    childCapabilityId: "commit-input",
    async execute(input, context) {
      const parsedInput = CommitInputAbilityInputSchema.parse(input);
      return executeTextInput({ request: parsedInput, context });
    },
  };
}