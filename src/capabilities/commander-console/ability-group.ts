/**
 * Commander Console Ability Group
 *
 * Dispatches to one of 7 atomic child capabilities.
 * Commander is the human cockpit — not the engine.
 */

import { randomUUID } from "node:crypto";
import {
  CommanderConsoleInputSchema,
  CommanderConsoleResultSchema,
  COMMANDER_CONSOLE_ABILITY_GROUP_ID,
  type CommanderConsoleResult,
} from "./schema.js";
import { createCommanderRegistry, listCommanderChildren } from "./registry.js";
import { buildCommanderProof, buildCommanderFailureResult } from "./result.js";
import type { CreateCommanderConsoleInput } from "./contract.js";
import type { CommanderChildContext } from "./children.js";

type CommanderRawInput = {
  childCapabilityId: string;
  operatorRef?: string;
  input?: Record<string, unknown>;
};

type CommanderFailureInput = {
  childCapabilityId: string;
  commandType: string;
  operatorRef: string;
  failureReason: string;
  startedAt: string;
  endedAt: string;
};

const createCommanderContext = (
  options: CreateCommanderConsoleInput,
): CommanderChildContext => ({
  commandTransport: options.commandTransport,
  getMissionStatus: options.getMissionStatus,
});

const buildCommanderFailure = (
  input: CommanderFailureInput,
): CommanderConsoleResult => {
  const proof = buildCommanderProof({
    childCapabilityId: input.childCapabilityId,
    commandId: randomUUID(),
    commandType: input.commandType,
    operatorRef: input.operatorRef,
    missionId: null,
    status: "failed",
    failureReason: input.failureReason,
    reviewRequiredReason: null,
    envelopeId: null,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  });
  return buildCommanderFailureResult(input.failureReason, proof);
};

const buildGlobalInputFailure = (
  rawInput: CommanderRawInput,
  options: CreateCommanderConsoleInput,
  failureReason: string,
): CommanderConsoleResult => {
  const startedAt = new Date().toISOString();
  return buildCommanderFailure({
    childCapabilityId: "issue-human-command",
    commandType: rawInput.childCapabilityId
      ? String(rawInput.childCapabilityId)
      : "unknown",
    operatorRef: rawInput.operatorRef ?? options.defaultOperatorRef,
    failureReason,
    startedAt,
    endedAt: startedAt,
  });
};

const buildUnknownChildFailure = (
  childCapabilityId: string,
  operatorRef: string,
): CommanderConsoleResult => {
  const startedAt = new Date().toISOString();
  return buildCommanderFailure({
    childCapabilityId,
    commandType: childCapabilityId,
    operatorRef,
    failureReason: `unknown_child_capability: ${childCapabilityId}`,
    startedAt,
    endedAt: startedAt,
  });
};

const buildChildExecutionFailure = (
  childCapabilityId: string,
  operatorRef: string,
  reason: string,
): CommanderConsoleResult => {
  const startedAt = new Date().toISOString();
  return buildCommanderFailure({
    childCapabilityId,
    commandType: childCapabilityId,
    operatorRef,
    failureReason: reason,
    startedAt,
    endedAt: new Date().toISOString(),
  });
};

const executeCommanderInput = async (
  rawInput: CommanderRawInput,
  options: CreateCommanderConsoleInput,
  registry: ReturnType<typeof createCommanderRegistry>,
  context: CommanderChildContext,
): Promise<CommanderConsoleResult> => {
  const parsed = CommanderConsoleInputSchema.safeParse({
    childCapabilityId: rawInput.childCapabilityId,
    operatorRef: rawInput.operatorRef ?? options.defaultOperatorRef,
    input: rawInput.input ?? {},
  });

  if (!parsed.success) {
    return buildGlobalInputFailure(
      rawInput,
      options,
      `global_input_invalid: ${parsed.error.message}`,
    );
  }

  const child = registry.get(parsed.data.childCapabilityId);
  if (!child) {
    return buildUnknownChildFailure(
      parsed.data.childCapabilityId,
      parsed.data.operatorRef,
    );
  }

  try {
    const result = await child(parsed.data.input, parsed.data.operatorRef, context);
    return CommanderConsoleResultSchema.parse(result);
  } catch (err) {
    return buildChildExecutionFailure(
      parsed.data.childCapabilityId,
      parsed.data.operatorRef,
      err instanceof Error ? err.message : "Child execution threw unknown error",
    );
  }
};

export const createCommanderConsoleAbilityGroup = (options: CreateCommanderConsoleInput) => {
  const registry = createCommanderRegistry();
  const context = createCommanderContext(options);

  return {
    abilityGroupId: COMMANDER_CONSOLE_ABILITY_GROUP_ID,
    listChildCapabilityIds: listCommanderChildren,
    execute: (rawInput: CommanderRawInput) =>
      executeCommanderInput(rawInput, options, registry, context),
  } as const;
};
