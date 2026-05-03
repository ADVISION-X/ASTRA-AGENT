import { buildPayloadDocument, buildTransportEnvelopeBase } from "./workbench-payload.js";
import type { HumanCommandDispatchInput } from "../../capabilities/nerve-bus/contract.js";

type HumanCommandDispatchTargetRecordRef = {
  recordId: string;
};

type HumanCommandDispatchCommand = {
  commandId: string;
  idempotencyKey: string;
  timeoutMs: number;
  commandType: string;
  targetMissionId: string | null;
  selectedMapId: string | null;
  requestedPlatformId: string | null;
  humanGoal: string | null;
  maxRounds: number | null;
  maxMinutes: number | null;
  operatorNote: string | null;
  targetRecordRef: HumanCommandDispatchTargetRecordRef | null;
};

type HumanCommandTransportResultEnvelope = {
  status: "success" | "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
};

const buildHumanCommandInputContent = (command: HumanCommandDispatchCommand) => ({
  commandId: command.commandId,
  commandType: command.commandType,
  idempotencyKey: command.idempotencyKey,
  timeoutMs: command.timeoutMs,
  targetMissionId: command.targetMissionId ?? null,
  selectedMapId: command.selectedMapId ?? null,
  requestedPlatformId: command.requestedPlatformId ?? null,
  humanGoal: command.humanGoal ?? null,
  maxRounds: command.maxRounds ?? null,
  maxMinutes: command.maxMinutes ?? null,
  operatorNote: command.operatorNote ?? null,
  targetRecordId: command.targetRecordRef?.recordId ?? null,
});

const buildHumanCommandInputPayload = (command: HumanCommandDispatchCommand) => {
  return buildPayloadDocument({
    documentType: "human.command",
    documentRef: `commander-console:${command.commandId}:input`,
    summary: `Commander command ${command.commandType}`,
    content: buildHumanCommandInputContent(command),
  });
};

const buildHumanCommandEnvelope = (command: HumanCommandDispatchCommand, inputPayload: ReturnType<typeof buildHumanCommandInputPayload>) => ({
  ...buildTransportEnvelopeBase({
    channelId: "commander-to-orchestration",
    envelopeId: `commander-console:${command.commandId}`,
    missionId: command.targetMissionId ?? "human-command",
    mapId: command.selectedMapId ?? "human-command",
    stepId: command.commandType,
    inputRef: inputPayload.documentRef,
    payloadRefs: { input: inputPayload.documentRef },
    summary: inputPayload.summary,
    tags: ["commander-console", command.commandType],
    idempotencyKey: command.idempotencyKey,
    expiresAt: new Date(Date.now() + command.timeoutMs).toISOString(),
  }),
  commandId: command.commandId,
  envelopeKind: "human_command" as const,
  from: "commander-console" as const,
  to: "orchestration" as const,
  commandType: command.commandType,
});

export const buildHumanCommandDispatchInput = (
  command: HumanCommandDispatchCommand,
): HumanCommandDispatchInput => {
  const inputPayload = buildHumanCommandInputPayload(command);
  return {
    envelope: buildHumanCommandEnvelope(command, inputPayload),
    inputPayload,
  };
};

export const describeHumanCommandTransportMessage = (
  resultEnvelope: HumanCommandTransportResultEnvelope,
): string => {
  if (resultEnvelope.status === "failed") {
    return resultEnvelope.failureReason ?? "command transport failed";
  }
  if (resultEnvelope.status === "review_required") {
    return resultEnvelope.failureReason ?? "command transport requires review";
  }
  return resultEnvelope.reviewRequiredReason ?? "command accepted";
};