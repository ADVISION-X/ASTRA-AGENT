import { COMMANDER_COMMAND_CHILDREN } from "./children/command-children.js";
import { COMMANDER_READ_CHILDREN } from "./children/read-children.js";
import type { CommanderConsoleChildAbilityId, CommanderDispatchChildId } from "./contract.js";
import { CommanderConsoleChildAbilityIdSchema } from "./schema.js";
import type { CommanderConsoleChildDefinition } from "./runtime/commander-console-executor.js";

export type CommanderConsoleChildRegistryEntry<TInput, TOutput> = {
  childCapabilityId: CommanderConsoleChildAbilityId;
  childKind: "command" | "read";
  inputSchema: CommanderConsoleChildDefinition<TInput, TOutput>["inputSchema"];
  outputSchema: CommanderConsoleChildDefinition<TInput, TOutput>["outputSchema"];
  implementation: CommanderConsoleChildDefinition<TInput, TOutput>;
  allowedCaller: "commander-console";
  boundaryDecision: "command-transport-only" | "read-port-only";
  ownedCommandType: CommanderConsoleChildDefinition<TInput, TOutput>["ownedCommandType"];
  readModelSource: CommanderConsoleChildDefinition<TInput, TOutput>["readModelSource"];
  requiresOperatorRef: true;
  hardStopPriority: CommanderConsoleChildDefinition<TInput, TOutput>["hardStopPriority"];
  maxDurationMs: number;
  idempotencyPolicy: CommanderConsoleChildDefinition<TInput, TOutput>["idempotencyPolicy"];
  boundaryPolicy: CommanderConsoleChildDefinition<TInput, TOutput>["boundaryPolicy"];
  evidencePolicy: CommanderConsoleChildDefinition<TInput, TOutput>["evidencePolicy"];
  proofPolicy: CommanderConsoleChildDefinition<TInput, TOutput>["proofPolicy"];
};

const COMMANDER_CONSOLE_CHILD_REGISTRY = [
  ...COMMANDER_READ_CHILDREN,
  ...COMMANDER_COMMAND_CHILDREN,
].map((implementation) => ({
  childCapabilityId: implementation.childCapabilityId,
  childKind: implementation.childKind,
  inputSchema: implementation.inputSchema,
  outputSchema: implementation.outputSchema,
  implementation,
  allowedCaller: implementation.allowedCaller,
  boundaryDecision: implementation.boundaryDecision,
  ownedCommandType: implementation.ownedCommandType,
  readModelSource: implementation.readModelSource,
  requiresOperatorRef: implementation.requiresOperatorRef,
  hardStopPriority: implementation.hardStopPriority,
  maxDurationMs: implementation.maxDurationMs,
  idempotencyPolicy: implementation.idempotencyPolicy,
  boundaryPolicy: implementation.boundaryPolicy,
  evidencePolicy: implementation.evidencePolicy,
  proofPolicy: implementation.proofPolicy,
}));

const COMMANDER_CONSOLE_CHILD_MAP = new Map(
  COMMANDER_CONSOLE_CHILD_REGISTRY.map((entry) => [
    entry.childCapabilityId,
    entry.implementation as CommanderConsoleChildDefinition<unknown, unknown>,
  ]),
);

export function listCommanderConsoleChildMetadata() {
  return [...COMMANDER_CONSOLE_CHILD_REGISTRY];
}

export function getCommanderConsoleChild(childCapabilityId: CommanderDispatchChildId) {
  const parsed = CommanderConsoleChildAbilityIdSchema.safeParse(childCapabilityId);
  return parsed.success ? COMMANDER_CONSOLE_CHILD_MAP.get(parsed.data) ?? null : null;
}