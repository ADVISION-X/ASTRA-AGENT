import type { CommanderConsoleAbilityGroup, CommanderConsoleInput, CreateCommanderConsoleAbilityGroupInput } from "./contract.js";
import { CommanderConsoleInputSchema } from "./schema.js";
import { executeCommanderConsoleChild, type CommanderConsoleChildContext } from "./runtime/commander-console-executor.js";
import { getCommanderConsoleChild, listCommanderConsoleChildren } from "./registry.js";

export function createCommanderConsoleAbilityGroup(input: CreateCommanderConsoleAbilityGroupInput): CommanderConsoleAbilityGroup {
  const context: CommanderConsoleChildContext = {
    ...input,
    now: input.now ?? (() => new Date().toISOString()),
  };

  return {
    listChildAbilityIds() {
      return listCommanderConsoleChildren().map((child) => child.childCapabilityId);
    },
    async execute(executionInput: CommanderConsoleInput) {
      const parsedInput = CommanderConsoleInputSchema.parse(executionInput);
      const child = getCommanderConsoleChild(parsedInput.childCapabilityId);
      return executeCommanderConsoleChild({ child, executionInput: parsedInput, context });
    },
  };
}