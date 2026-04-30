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

function commandOwnedByChild(childCapabilityId: CommanderCommandChildAbilityId): CommanderCommandType {
  switch (childCapabilityId) {
    case "issue-human-command":
      return "start-mission";
    case "pause-mission":
      return "pause-mission";
    case "resume-mission":
      return "resume-mission";
    case "stop-mission":
      return "stop-mission";
    case "emergency-stop":
      return "emergency-stop";
    case "approve-candidate":
      return "approve-candidate";
    case "reject-candidate":
      return "reject-candidate";
    case "mark-review-required":
      return "mark-review-required";
  }
}

function buildTransportPayload(commandInput: CommanderHumanCommandInput): CommanderHumanCommand["payload"] {
  switch (commandInput.commandType) {
    case "start-mission":
      return StartMissionTransportPayloadSchema.parse(
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
    case "pause-mission":
      return PauseMissionTransportPayloadSchema.parse({
        kind: "pause-mission",
        requestedBy: "commander-console",
        targetMissionId: commandInput.targetMissionId ?? null,
        operatorNote: commandInput.operatorNote ?? null,
      });
    case "resume-mission":
      return ResumeMissionTransportPayloadSchema.parse({
        kind: "resume-mission",
        requestedBy: "commander-console",
        targetMissionId: commandInput.targetMissionId ?? null,
        operatorNote: commandInput.operatorNote ?? null,
      });
    case "stop-mission":
      return StopMissionTransportPayloadSchema.parse({
        kind: "stop-mission",
        requestedBy: "commander-console",
        targetMissionId: commandInput.targetMissionId ?? null,
        operatorNote: commandInput.operatorNote ?? null,
      });
    case "emergency-stop":
      return EmergencyStopTransportPayloadSchema.parse({
        kind: "emergency-stop",
        requestedBy: "commander-console",
        targetMissionId: commandInput.targetMissionId ?? null,
        operatorNote: commandInput.operatorNote ?? null,
      });
    case "approve-candidate":
      return ApproveCandidateTransportPayloadSchema.parse({
        kind: "approve-candidate",
        requestedBy: "commander-console",
        candidateId: commandInput.targetRecordRef!.recordId,
        operatorNote: commandInput.operatorNote ?? null,
      });
    case "reject-candidate":
      return RejectCandidateTransportPayloadSchema.parse({
        kind: "reject-candidate",
        requestedBy: "commander-console",
        candidateId: commandInput.targetRecordRef!.recordId,
        operatorNote: commandInput.operatorNote ?? null,
      });
    case "mark-review-required":
      return MarkReviewRequiredTransportPayloadSchema.parse({
        kind: "mark-review-required",
        requestedBy: "commander-console",
        candidateId: commandInput.targetRecordRef!.recordId,
        operatorNote: commandInput.operatorNote ?? null,
      });
  }
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

export function gateCommanderCommand(input: {
  childCapabilityId: CommanderCommandChildAbilityId;
  operatorRef: string;
  commandInput: CommanderHumanCommandInput;
}): CommanderCommandGateResult {
  const inputRef = createId("commander_command_input");
  const commandId = createId("commander_command");
  const expectedCommandType = commandOwnedByChild(input.childCapabilityId);
  const parsed = HumanCommandInputSchema.safeParse(input.commandInput);
  if (!parsed.success) {
    return {
      ok: false,
      inputRef,
      commandId,
      commandType: expectedCommandType,
      priority: PRIORITY_BY_COMMAND[expectedCommandType],
      targetMissionId: input.commandInput.targetMissionId ?? null,
      targetRecordRef: input.commandInput.targetRecordRef ?? null,
      reason: parsed.error.issues[0]?.message ?? "Commander command input failed schema validation.",
    };
  }

  if (!input.operatorRef.trim()) {
    return {
      ok: false,
      inputRef,
      commandId,
      commandType: expectedCommandType,
      priority: PRIORITY_BY_COMMAND[expectedCommandType],
      targetMissionId: parsed.data.targetMissionId ?? null,
      targetRecordRef: parsed.data.targetRecordRef ?? null,
      reason: "operatorRef is required.",
    };
  }

  if (parsed.data.commandType !== expectedCommandType) {
    return {
      ok: false,
      inputRef,
      commandId,
      commandType: parsed.data.commandType,
      priority: PRIORITY_BY_COMMAND[parsed.data.commandType],
      targetMissionId: parsed.data.targetMissionId ?? null,
      targetRecordRef: parsed.data.targetRecordRef ?? null,
      reason: `Child ${input.childCapabilityId} only owns ${expectedCommandType}.`,
    };
  }

  if (input.childCapabilityId === "emergency-stop" && PRIORITY_BY_COMMAND[parsed.data.commandType] !== "emergency") {
    return {
      ok: false,
      inputRef,
      commandId,
      commandType: parsed.data.commandType,
      priority: PRIORITY_BY_COMMAND[parsed.data.commandType],
      targetMissionId: parsed.data.targetMissionId ?? null,
      targetRecordRef: parsed.data.targetRecordRef ?? null,
      reason: "emergency-stop must dispatch with emergency priority.",
    };
  }

  const payload = buildTransportPayload(parsed.data);
  return {
    ok: true,
    inputRef,
    command: {
      commandId,
      commandType: parsed.data.commandType,
      priority: PRIORITY_BY_COMMAND[parsed.data.commandType],
      operatorRef: input.operatorRef,
      targetMissionId: parsed.data.targetMissionId ?? null,
      selectedMapId: parsed.data.selectedMapId ?? null,
      targetRecordRef: parsed.data.targetRecordRef ?? null,
      requestedPlatformId: parsed.data.requestedPlatformId ?? null,
      humanGoal: parsed.data.humanGoal ?? null,
      maxRounds: parsed.data.maxRounds ?? null,
      maxMinutes: parsed.data.maxMinutes ?? null,
      operatorNote: parsed.data.operatorNote ?? null,
      payload,
    },
  };
}

export function parseCommandTransportResult(result: HumanCommandTransportResult): HumanCommandTransportResult {
  return CommandTransportResultSchema.parse(result);
}