import { createId } from "../../../lib/local-runtime/ids.js";
import type {
  CommanderCommandChildAbilityId,
  CommanderCommandType,
  CommanderHumanCommandInput,
  CommanderTargetRecordRef,
} from "../contract.js";
import type { CommanderHumanCommand, HumanCommandTransportResult } from "../ports/command-transport-port.js";
import {
  ApproveCandidateTransportPayloadSchema,
  CommandTransportResultSchema,
  EmergencyStopTransportPayloadSchema,
  HumanCommandInputSchema,
  MarkReviewRequiredTransportPayloadSchema,
  PauseMissionTransportPayloadSchema,
  RejectCandidateTransportPayloadSchema,
  ResumeMissionTransportPayloadSchema,
  StartMissionTransportPayloadSchema,
  StopMissionTransportPayloadSchema,
} from "../schema.js";
import type { CommanderCommandPriority } from "../shared/commander-proof.js";

const PRIORITY_BY_COMMAND: Record<CommanderCommandType, CommanderCommandPriority> = {
  "start-mission": "normal",
  "pause-mission": "normal",
  "resume-mission": "normal",
  "stop-mission": "normal",
  "emergency-stop": "emergency",
  "approve-candidate": "normal",
  "reject-candidate": "normal",
  "mark-review-required": "normal",
};

const OWNED_COMMAND_BY_CHILD: Record<CommanderCommandChildAbilityId, CommanderCommandType> = {
  "issue-human-command": "start-mission",
  "pause-mission": "pause-mission",
  "resume-mission": "resume-mission",
  "stop-mission": "stop-mission",
  "emergency-stop": "emergency-stop",
  "approve-candidate": "approve-candidate",
  "reject-candidate": "reject-candidate",
  "mark-review-required": "mark-review-required",
};

function commandOwnedByChild(childCapabilityId: CommanderCommandChildAbilityId): CommanderCommandType {
  return OWNED_COMMAND_BY_CHILD[childCapabilityId];
}

const buildStartMissionPayload = (commandInput: CommanderHumanCommandInput) => StartMissionTransportPayloadSchema.parse(
  commandInput.initialPayload ?? {
    kind: "start-mission",
    requestedBy: "commander-console",
    ...(commandInput.requestedPlatformId ? { requestedPlatformId: commandInput.requestedPlatformId } : {}),
    ...(commandInput.selectedMapId ? { selectedMapId: commandInput.selectedMapId } : {}),
    ...(commandInput.humanGoal ? { humanGoal: commandInput.humanGoal } : {}),
    ...(commandInput.maxRounds ? { maxRounds: commandInput.maxRounds } : {}),
    ...(commandInput.maxMinutes ? { maxMinutes: commandInput.maxMinutes } : {}),
    ...(commandInput.operatorNote ? { operatorNote: commandInput.operatorNote } : {}),
  },
);

const buildMissionTransportPayload = (
  schema:
    | typeof PauseMissionTransportPayloadSchema
    | typeof ResumeMissionTransportPayloadSchema
    | typeof StopMissionTransportPayloadSchema
    | typeof EmergencyStopTransportPayloadSchema,
  kind: "pause-mission" | "resume-mission" | "stop-mission" | "emergency-stop",
  commandInput: CommanderHumanCommandInput,
) => schema.parse({
  kind,
  requestedBy: "commander-console",
  targetMissionId: commandInput.targetMissionId ?? null,
  operatorNote: commandInput.operatorNote ?? null,
});

const buildCandidateTransportPayload = (
  schema:
    | typeof ApproveCandidateTransportPayloadSchema
    | typeof RejectCandidateTransportPayloadSchema
    | typeof MarkReviewRequiredTransportPayloadSchema,
  kind: "approve-candidate" | "reject-candidate" | "mark-review-required",
  commandInput: CommanderHumanCommandInput,
) => schema.parse({
  kind,
  requestedBy: "commander-console",
  candidateId: commandInput.targetRecordRef!.recordId,
  operatorNote: commandInput.operatorNote ?? null,
});

const TRANSPORT_PAYLOAD_BUILDERS: Record<CommanderCommandType, (commandInput: CommanderHumanCommandInput) => CommanderHumanCommand["payload"]> = {
  "start-mission": buildStartMissionPayload,
  "pause-mission": (commandInput) => buildMissionTransportPayload(PauseMissionTransportPayloadSchema, "pause-mission", commandInput),
  "resume-mission": (commandInput) => buildMissionTransportPayload(ResumeMissionTransportPayloadSchema, "resume-mission", commandInput),
  "stop-mission": (commandInput) => buildMissionTransportPayload(StopMissionTransportPayloadSchema, "stop-mission", commandInput),
  "emergency-stop": (commandInput) => buildMissionTransportPayload(EmergencyStopTransportPayloadSchema, "emergency-stop", commandInput),
  "approve-candidate": (commandInput) => buildCandidateTransportPayload(ApproveCandidateTransportPayloadSchema, "approve-candidate", commandInput),
  "reject-candidate": (commandInput) => buildCandidateTransportPayload(RejectCandidateTransportPayloadSchema, "reject-candidate", commandInput),
  "mark-review-required": (commandInput) => buildCandidateTransportPayload(MarkReviewRequiredTransportPayloadSchema, "mark-review-required", commandInput),
};

function buildTransportPayload(commandInput: CommanderHumanCommandInput): CommanderHumanCommand["payload"] {
  return TRANSPORT_PAYLOAD_BUILDERS[commandInput.commandType](commandInput);
}

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

  if (parsed.data.commandType !== input.expectedCommandType) {
    return createCommandGateFailure({
      inputRef: input.inputRef,
      commandId: input.commandId,
      commandType: parsed.data.commandType,
      targetMissionId: parsed.data.targetMissionId ?? null,
      targetRecordRef: parsed.data.targetRecordRef ?? null,
      reason: `Child ${input.childCapabilityId} only owns ${input.expectedCommandType}.`,
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
  return {
    ok: true,
    inputRef,
    command: {
      commandId,
      commandType: parsed.commandType,
      priority: PRIORITY_BY_COMMAND[parsed.commandType],
      operatorRef: input.operatorRef,
      targetMissionId: parsed.targetMissionId ?? null,
      selectedMapId: parsed.selectedMapId ?? null,
      targetRecordRef: parsed.targetRecordRef ?? null,
      requestedPlatformId: parsed.requestedPlatformId ?? null,
      humanGoal: parsed.humanGoal ?? null,
      maxRounds: parsed.maxRounds ?? null,
      maxMinutes: parsed.maxMinutes ?? null,
      operatorNote: parsed.operatorNote ?? null,
      payload,
    },
  };
}

export function parseCommandTransportResult(result: HumanCommandTransportResult): HumanCommandTransportResult {
  return CommandTransportResultSchema.parse(result);
}