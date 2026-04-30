import type { CommanderConsoleAbilityGroup, CommanderConsoleInput, CreateCommanderConsoleAbilityGroupInput } from "./contract.js";
import { createSystemCommanderClock } from "./runtime/commander-clock.js";
import { executeCommanderConsoleChild, type CommanderConsoleChildContext } from "./runtime/commander-console-executor.js";
import { getCommanderConsoleChild, listCommanderConsoleChildMetadata } from "./registry.js";
import { CommanderConsoleInputSchema } from "./schema.js";
import { buildInvalidCommanderInputResult } from "./shared/commander-invalid-input-result.js";

export function createCommanderConsoleAbilityGroup(input: CreateCommanderConsoleAbilityGroupInput): CommanderConsoleAbilityGroup {
  const context: CommanderConsoleChildContext = {
    ...input,
    clock: input.clock ?? createSystemCommanderClock(),
  };

  return {
    listChildAbilityIds() {
      return listCommanderConsoleChildMetadata().map((child) => child.childCapabilityId);
    },
    async execute(executionInput: CommanderConsoleInput) {
      const parsedInput = CommanderConsoleInputSchema.safeParse(executionInput);
      if (!parsedInput.success) {
        return buildInvalidCommanderInputResult({
          rawInput: executionInput,
          errorMessage: parsedInput.error.issues[0]?.message ?? "Commander Console input failed validation.",
          context,
        });
      }

      const child = getCommanderConsoleChild(parsedInput.data.childCapabilityId);
      return executeCommanderConsoleChild({
        child,
        executionInput: parsedInput.data,
        context,
      });
    },
  };
}