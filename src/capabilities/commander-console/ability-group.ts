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

export const createCommanderConsoleAbilityGroup = (options: CreateCommanderConsoleInput) => {
  const registry = createCommanderRegistry();

  const context: CommanderChildContext = {
    commandTransport: options.commandTransport,
    getMissionStatus: options.getMissionStatus,
  };

  const execute = async (rawInput: {
    childCapabilityId: string;
    operatorRef?: string;
    input?: Record<string, unknown>;
  }): Promise<CommanderConsoleResult> => {
    const parsed = CommanderConsoleInputSchema.safeParse({
      childCapabilityId: rawInput.childCapabilityId,
      operatorRef: rawInput.operatorRef ?? options.defaultOperatorRef,
      input: rawInput.input ?? {},
    });

    if (!parsed.success) {
      const startedAt = new Date().toISOString();
      const proof = buildCommanderProof({
        childCapabilityId: "issue-human-command",
        commandId: randomUUID(),
        commandType: rawInput.childCapabilityId ?? "unknown",
        operatorRef: rawInput.operatorRef ?? options.defaultOperatorRef,
        missionId: null,
        status: "failed",
        failureReason: `global_input_invalid: ${parsed.error.message}`,
        reviewRequiredReason: null,
        envelopeId: null,
        startedAt,
        endedAt: startedAt,
      });
      return buildCommanderFailureResult(`global_input_invalid: ${parsed.error.message}`, proof);
    }

    const child = registry.get(parsed.data.childCapabilityId);
    if (!child) {
      const startedAt = new Date().toISOString();
      const proof = buildCommanderProof({
        childCapabilityId: parsed.data.childCapabilityId,
        commandId: randomUUID(),
        commandType: parsed.data.childCapabilityId,
        operatorRef: parsed.data.operatorRef,
        missionId: null,
        status: "failed",
        failureReason: `unknown_child_capability: ${parsed.data.childCapabilityId}`,
        reviewRequiredReason: null,
        envelopeId: null,
        startedAt,
        endedAt: startedAt,
      });
      return buildCommanderFailureResult(`unknown_child_capability: ${parsed.data.childCapabilityId}`, proof);
    }

    try {
      const result = await child(parsed.data.input, parsed.data.operatorRef, context);
      return CommanderConsoleResultSchema.parse(result);
    } catch (err) {
      const startedAt = new Date().toISOString();
      const reason = err instanceof Error ? err.message : "Child execution threw unknown error";
      const proof = buildCommanderProof({
        childCapabilityId: parsed.data.childCapabilityId,
        commandId: randomUUID(),
        commandType: parsed.data.childCapabilityId,
        operatorRef: parsed.data.operatorRef,
        missionId: null,
        status: "failed",
        failureReason: reason,
        reviewRequiredReason: null,
        envelopeId: null,
        startedAt,
        endedAt: new Date().toISOString(),
      });
      return buildCommanderFailureResult(reason, proof);
    }
  };

  return {
    abilityGroupId: COMMANDER_CONSOLE_ABILITY_GROUP_ID,
    listChildCapabilityIds: listCommanderChildren,
    execute,
  } as const;
};
