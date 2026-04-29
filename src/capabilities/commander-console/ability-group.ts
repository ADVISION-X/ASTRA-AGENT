import type { CommanderConsoleAbilityGroup, CommanderConsoleInput, CreateCommanderConsoleAbilityGroupInput } from "./contract.js";
import { CommanderConsoleInputSchema } from "./schema.js";
import { createSystemCommanderClock } from "./runtime/commander-clock.js";
import { executeCommanderConsoleChild, type CommanderConsoleChildContext } from "./runtime/commander-console-executor.js";
import { getCommanderConsoleChild, listCommanderConsoleChildMetadata } from "./registry.js";
export function createCommanderConsoleAbilityGroup(input: CreateCommanderConsoleAbilityGroupInput): CommanderConsoleAbilityGroup {
  const context: CommanderConsoleChildContext = { ...input, clock: input.clock ?? createSystemCommanderClock() };
  return { listChildAbilityIds() { return listCommanderConsoleChildMetadata().map((child) => child.childCapabilityId); }, async execute(executionInput: CommanderConsoleInput) { const parsedInput = CommanderConsoleInputSchema.parse(executionInput); const child = getCommanderConsoleChild(parsedInput.childCapabilityId); return executeCommanderConsoleChild({ child, executionInput: parsedInput, context }); } };
}
