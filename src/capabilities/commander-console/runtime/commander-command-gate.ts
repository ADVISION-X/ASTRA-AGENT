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

const buildPauseMissionPayload = (commandInput: CommanderHumanCommandInput) => PauseMissionTransportPayloadSchema.parse({
  kind: "pause-mission",
  requestedBy: "commander-console",
  targetMissionId: commandInput.targetMissionId ?? null,
  operatorNote: commandInput.operatorNote ?? null,
});

const buildResumeMissionPayload = (commandInput: CommanderHumanCommandInput) => ResumeMissionTransportPayloadSchema.parse({
  kind: "resume-mission",
  requestedBy: "commander-console",
  targetMissionId: commandInput.targetMissionId ?? null,
  operatorNote: commandInput.operatorNote ?? null,
});

const buildStopMissionPayload = (commandInput: CommanderHumanCommandInput) => StopMissionTransportPayloadSchema.parse({
  kind: "stop-mission",
  requestedBy: "commander-console",
  targetMissionId: commandInput.targetMissionId ?? null,
  operatorNote: commandInput.operatorNote ?? null,
});

const buildEmergencyStopPayload = (commandInput: CommanderHumanCommandInput) => EmergencyStopTransportPayloadSchema.parse({
  kind: "emergency-stop",
  requestedBy: "commander-console",
  targetMissionId: commandInput.targetMissionId ?? null,
  operatorNote: commandInput.operatorNote ?? null,
});

const buildApproveCandidatePayload = (commandInput: CommanderHumanCommandInput) => ApproveCandidateTransportPayloadSchema.parse({
  kind: "approve-candidate",
  requestedBy: "commander-console",
  candidateId: commandInput.targetRecordRef!.recordId,
  operatorNote: commandInput.operatorNote ?? null,
});

const buildRejectCandidatePayload = (commandInput: CommanderHumanCommandInput) => RejectCandidateTransportPayloadSchema.parse({
  kind: "reject-candidate",
  requestedBy: "commander-console",
  candidateId: commandInput.targetRecordRef!.recordId,
  operatorNote: commandInput.operatorNote ?? null,
});

const buildMarkReviewRequiredPayload = (commandInput: CommanderHumanCommandInput) => MarkReviewRequiredTransportPayloadSchema.parse({
  kind: "mark-review-required",
  requestedBy: "commander-console",
  candidateId: commandInput.targetRecordRef!.recordId,
  operatorNote: commandInput.operatorNote ?? null,
});

const TRANSPORT_PAYLOAD_BUILDERS: Record<CommanderCommandType, (commandInput: CommanderHumanCommandInput) => CommanderHumanCommand["payload"]> = {
  "start-mission": buildStartMissionPayload,
  "pause-mission": buildPauseMissionPayload,
  "resume-mission": buildResumeMissionPayload,
  "stop-mission": buildStopMissionPayload,
  "emergency-stop": buildEmergencyStopPayload,
  "approve-candidate": buildApproveCandidatePayload,
  "reject-candidate": buildRejectCandidatePayload,
  "mark-review-required": buildMarkReviewRequiredPayload,
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