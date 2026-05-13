import { createId } from "../../../lib/local-runtime/ids.js";
import type {
  CommanderCommandChildAbilityId,
  CommanderCommandType,
  CommanderHumanCommandInput,
  CommanderTargetRecordRef,
} from "../contract.js";
import type { CommanderHumanCommand } from "../ports/command-transport-port.js";
import { HumanCommandInputSchema } from "../schema.js";
import type { CommanderCommandPriority } from "../shared/commander-proof.js";
import { buildCommandIdempotencyKey, buildTransportPayload } from "./commander-command-payload.js";

const PRIORITY_BY_COMMAND: Record<CommanderCommandType, CommanderCommandPriority> = {
  "start-mission": "normal",
  "pause-mission": "normal",
  "resume-mission": "normal",
  "stop-mission": "normal",
  "emergency-stop": "emergency",
  "mark-review-required": "normal",
};

const OWNED_COMMAND_BY_CHILD: Record<CommanderCommandChildAbilityId, CommanderCommandType> = {
  "issue-human-command": "start-mission",
  "pause-mission": "pause-mission",
  "resume-mission": "resume-mission",
  "stop-mission": "stop-mission",
  "emergency-stop": "emergency-stop",
  "mark-review-required": "mark-review-required",
};

export type CommanderCommandGateSuccess = {
  ok: true;
  inputRef: string;
  command: CommanderHumanCommand;
};

export type CommanderCommandGateFailure = {
  ok: false;
  inputRef: string;
  commandId: string;
  commandType: CommanderCommandType;
  priority: CommanderCommandPriority;
  targetMissionId: string | null;
  targetRecordRef: CommanderTargetRecordRef | null;
  reason: string;
};

export type CommanderCommandGateResult = CommanderCommandGateSuccess | CommanderCommandGateFailure;

function commandOwnedByChild(childCapabilityId: CommanderCommandChildAbilityId): CommanderCommandType {
  return OWNED_COMMAND_BY_CHILD[childCapabilityId];
}

const createCommandGateFailure = (input: {
  inputRef: string;
  commandId: string;
  commandType: CommanderCommandType;
  targetMissionId: string | null;
  targetRecordRef: CommanderTargetRecordRef | null;
  reason: string;
}): CommanderCommandGateFailure => ({
  ok: false,
  inputRef: input.inputRef,
  commandId: input.commandId,
  commandType: input.commandType,
  priority: PRIORITY_BY_COMMAND[input.commandType],
  targetMissionId: input.targetMissionId,
  targetRecordRef: input.targetRecordRef,
  reason: input.reason,
});

const createCommandGateSuccess = (input: {
  childCapabilityId: CommanderCommandChildAbilityId;
  operatorRef: string;
  maxDurationMs: number;
  inputRef: string;
  commandId: string;
  parsed: CommanderHumanCommandInput;
  payload: CommanderHumanCommand["payload"];
}): CommanderCommandGateSuccess => ({
  ok: true,
  inputRef: input.inputRef,
  command: {
    commandId: input.commandId,
    commandType: input.parsed.commandType,
    priority: PRIORITY_BY_COMMAND[input.parsed.commandType],
    operatorRef: input.operatorRef,
    targetMissionId: input.parsed.targetMissionId ?? null,
    targetBindingId: input.parsed.targetBindingId ?? null,
    targetRecordRef: input.parsed.targetRecordRef ?? null,
    requestedPlatformId: input.parsed.requestedPlatformId ?? null,
    humanGoal: input.parsed.humanGoal ?? null,
    maxRounds: input.parsed.maxRounds ?? null,
    maxMinutes: input.parsed.maxMinutes ?? null,
    operatorNote: input.parsed.operatorNote ?? null,
    idempotencyKey: buildCommandIdempotencyKey({
      childCapabilityId: input.childCapabilityId,
      operatorRef: input.operatorRef,
      commandInput: input.parsed,
    }),
    timeoutMs: input.maxDurationMs,
    payload: input.payload,
  },
});

const parseCommandGateInput = (input: {
  childCapabilityId: CommanderCommandChildAbilityId;
  operatorRef: string;
  commandInput: CommanderHumanCommandInput;
  inputRef: string;
  commandId: string;
  expectedCommandType: CommanderCommandType;
}) => {
  const parsed = HumanCommandInputSchema.safeParse(input.commandInput);
  if (!parsed.success) {
    return createCommandGateFailure({
      inputRef: input.inputRef,
      commandId: input.commandId,
      commandType: input.expectedCommandType,
      targetMissionId: input.commandInput.targetMissionId ?? null,
      targetRecordRef: input.commandInput.targetRecordRef ?? null,
      reason: parsed.error.issues[0]?.message ?? "Commander command input failed schema validation.",
    });
  }

  if (!input.operatorRef.trim()) {
    return createCommandGateFailure({
      inputRef: input.inputRef,
      commandId: input.commandId,
      commandType: input.expectedCommandType,
      targetMissionId: parsed.data.targetMissionId ?? null,
      targetRecordRef: parsed.data.targetRecordRef ?? null,
      reason: "operatorRef is required.",
    });
  }

  const expectedCommandType = input.expectedCommandType;
  if (parsed.data.commandType !== input.expectedCommandType) {
    return createCommandGateFailure({
      inputRef: input.inputRef,
      commandId: input.commandId,
      commandType: parsed.data.commandType,
      targetMissionId: parsed.data.targetMissionId ?? null,
      targetRecordRef: parsed.data.targetRecordRef ?? null,
      reason: `Child ${input.childCapabilityId} only owns ${expectedCommandType}.`,
    });
  }

  if (input.childCapabilityId === "emergency-stop" && PRIORITY_BY_COMMAND[parsed.data.commandType] !== "emergency") {
    return createCommandGateFailure({
      inputRef: input.inputRef,
      commandId: input.commandId,
      commandType: parsed.data.commandType,
      targetMissionId: parsed.data.targetMissionId ?? null,
      targetRecordRef: parsed.data.targetRecordRef ?? null,
      reason: "emergency-stop must dispatch with emergency priority.",
    });
  }

  return parsed.data;
};

export function gateCommanderCommand(input: {
  childCapabilityId: CommanderCommandChildAbilityId;
  operatorRef: string;
  commandInput: CommanderHumanCommandInput;
  maxDurationMs: number;
}): CommanderCommandGateResult {
  const inputRef = createId("commander_command_input");
  const commandId = createId("commander_command");
  const expectedCommandType = commandOwnedByChild(input.childCapabilityId);
  const parsed = parseCommandGateInput({
    childCapabilityId: input.childCapabilityId,
    operatorRef: input.operatorRef,
    commandInput: input.commandInput,
    inputRef,
    commandId,
    expectedCommandType,
  });
  if ("ok" in parsed) {
    return parsed;
  }

  const payload = buildTransportPayload(parsed);
  if (!payload.ok) {
    return createCommandGateFailure({
      inputRef,
      commandId,
      commandType: parsed.commandType,
      targetMissionId: parsed.targetMissionId ?? null,
      targetRecordRef: parsed.targetRecordRef ?? null,
      reason: payload.reason,
    });
  }

  return createCommandGateSuccess({
    childCapabilityId: input.childCapabilityId,
    operatorRef: input.operatorRef,
    maxDurationMs: input.maxDurationMs,
    inputRef,
    commandId,
    parsed,
    payload: payload.payload,
  });
}