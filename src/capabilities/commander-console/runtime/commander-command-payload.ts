import { createHash } from "node:crypto";

import type { ZodType } from "zod";

import type {
  CommanderCommandChildAbilityId,
  CommanderHumanCommandInput,
} from "../contract.js";
import type { CommanderHumanCommand } from "../ports/command-transport-port.js";
import {
  EmergencyStopTransportPayloadSchema,
  MarkReviewRequiredTransportPayloadSchema,
  PauseMissionTransportPayloadSchema,
  ResumeMissionTransportPayloadSchema,
  StartMissionTransportPayloadSchema,
  StopMissionTransportPayloadSchema,
} from "../schema.js";

type CommanderTransportPayloadResult =
  | { ok: true; payload: CommanderHumanCommand["payload"] }
  | { ok: false; reason: string };

function buildStartMissionPayloadInput(commandInput: CommanderHumanCommandInput) {
  return commandInput.initialPayload ?? {
    kind: "start-mission",
    requestedBy: "commander-console",
    ...(commandInput.requestedPlatformId ? { requestedPlatformId: commandInput.requestedPlatformId } : {}),
    ...(commandInput.targetBindingId ? { targetBindingId: commandInput.targetBindingId } : {}),
    ...(commandInput.humanGoal ? { humanGoal: commandInput.humanGoal } : {}),
    ...(commandInput.maxRounds ? { maxRounds: commandInput.maxRounds } : {}),
    ...(commandInput.maxMinutes ? { maxMinutes: commandInput.maxMinutes } : {}),
    ...(commandInput.operatorNote ? { operatorNote: commandInput.operatorNote } : {}),
  };
}

const buildPauseMissionPayloadInput = (commandInput: CommanderHumanCommandInput) => ({
  kind: "pause-mission",
  requestedBy: "commander-console",
  targetMissionId: commandInput.targetMissionId ?? null,
  operatorNote: commandInput.operatorNote ?? null,
});

const buildResumeMissionPayloadInput = (commandInput: CommanderHumanCommandInput) => ({
  kind: "resume-mission",
  requestedBy: "commander-console",
  targetMissionId: commandInput.targetMissionId ?? null,
  operatorNote: commandInput.operatorNote ?? null,
});

const buildStopMissionPayloadInput = (commandInput: CommanderHumanCommandInput) => ({
  kind: "stop-mission",
  requestedBy: "commander-console",
  targetMissionId: commandInput.targetMissionId ?? null,
  operatorNote: commandInput.operatorNote ?? null,
});

const buildEmergencyStopPayloadInput = (commandInput: CommanderHumanCommandInput) => ({
  kind: "emergency-stop",
  requestedBy: "commander-console",
  targetMissionId: commandInput.targetMissionId ?? null,
  operatorNote: commandInput.operatorNote ?? null,
});

const buildMarkReviewRequiredPayloadInput = (commandInput: CommanderHumanCommandInput) => ({
  kind: "mark-review-required",
  requestedBy: "commander-console",
  candidateId: commandInput.targetRecordRef!.recordId,
  operatorNote: commandInput.operatorNote ?? null,
});

function safeParsePayload<TPayload extends CommanderHumanCommand["payload"]>(input: {
  schema: ZodType<TPayload>;
  value: unknown;
  reason: string;
}): CommanderTransportPayloadResult {
  const parsed = input.schema.safeParse(input.value);
  if (!parsed.success) {
    return {
      ok: false,
      reason: parsed.error.issues[0]?.message ?? input.reason,
    };
  }

  return {
    ok: true,
    payload: parsed.data,
  };
}

const PAYLOAD_BUILDERS = {
  "start-mission": (commandInput: CommanderHumanCommandInput) => safeParsePayload({
    schema: StartMissionTransportPayloadSchema,
    value: buildStartMissionPayloadInput(commandInput),
    reason: "start-mission payload failed validation.",
  }),
  "pause-mission": (commandInput: CommanderHumanCommandInput) => safeParsePayload({
    schema: PauseMissionTransportPayloadSchema,
    value: buildPauseMissionPayloadInput(commandInput),
    reason: "pause-mission payload failed validation.",
  }),
  "resume-mission": (commandInput: CommanderHumanCommandInput) => safeParsePayload({
    schema: ResumeMissionTransportPayloadSchema,
    value: buildResumeMissionPayloadInput(commandInput),
    reason: "resume-mission payload failed validation.",
  }),
  "stop-mission": (commandInput: CommanderHumanCommandInput) => safeParsePayload({
    schema: StopMissionTransportPayloadSchema,
    value: buildStopMissionPayloadInput(commandInput),
    reason: "stop-mission payload failed validation.",
  }),
  "emergency-stop": (commandInput: CommanderHumanCommandInput) => safeParsePayload({
    schema: EmergencyStopTransportPayloadSchema,
    value: buildEmergencyStopPayloadInput(commandInput),
    reason: "emergency-stop payload failed validation.",
  }),
  "mark-review-required": (commandInput: CommanderHumanCommandInput) => safeParsePayload({
    schema: MarkReviewRequiredTransportPayloadSchema,
    value: buildMarkReviewRequiredPayloadInput(commandInput),
    reason: "mark-review-required payload failed validation.",
  }),
};

export function buildTransportPayload(commandInput: CommanderHumanCommandInput): CommanderTransportPayloadResult {
  return PAYLOAD_BUILDERS[commandInput.commandType](commandInput);
}

export function buildCommandIdempotencyKey(input: {
  childCapabilityId: CommanderCommandChildAbilityId;
  operatorRef: string;
  commandInput: CommanderHumanCommandInput;
}): string {
  const fingerprint = JSON.stringify({
    commandType: input.commandInput.commandType,
    targetMissionId: input.commandInput.targetMissionId ?? null,
    targetBindingId: input.commandInput.targetBindingId ?? null,
    targetRecordRef: input.commandInput.targetRecordRef ?? null,
    requestedPlatformId: input.commandInput.requestedPlatformId ?? null,
    humanGoal: input.commandInput.humanGoal ?? null,
    maxRounds: input.commandInput.maxRounds ?? null,
    maxMinutes: input.commandInput.maxMinutes ?? null,
    operatorNote: input.commandInput.operatorNote ?? null,
    initialPayload: input.commandInput.initialPayload ?? null,
  });
  const digest = createHash("sha256")
    .update(`${input.childCapabilityId}:${input.operatorRef}:${fingerprint}`)
    .digest("hex");
  return `commander-console:${input.childCapabilityId}:${digest}`;
}