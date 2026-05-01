import { createId } from "./ids.js";
import { buildPayloadDocument, buildTransportEnvelopeBase } from "./workbench-payload.js";
import type { HumanCommandDispatchInput } from "../../capabilities/nerve-bus/contract.js";

type HumanCommandDispatchTargetRecordRef = {
  recordId: string;
};

type HumanCommandDispatchCommand = {
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

export const buildHumanCommandDispatchInput = (
  command: HumanCommandDispatchCommand,
): HumanCommandDispatchInput => {
  const commandId = createId("commander_command");
  const inputPayload = buildPayloadDocument({
    documentType: "human.command",
    documentRef: `commander-console:${commandId}:input`,
    summary: `Commander command ${command.commandType}`,
    content: {
      commandType: command.commandType,
      targetMissionId: command.targetMissionId ?? null,
      selectedMapId: command.selectedMapId ?? null,
      requestedPlatformId: command.requestedPlatformId ?? null,
      humanGoal: command.humanGoal ?? null,
      maxRounds: command.maxRounds ?? null,
      maxMinutes: command.maxMinutes ?? null,
      operatorNote: command.operatorNote ?? null,
      targetRecordId: command.targetRecordRef?.recordId ?? null,
    },
  });
  return {
    envelope: {
      ...buildTransportEnvelopeBase({
        channelId: "commander-to-orchestration",
        envelopeId: `commander-console:${commandId}`,
        missionId: command.targetMissionId ?? "human-command",
        mapId: command.selectedMapId ?? "human-command",
        stepId: command.commandType,
        inputRef: inputPayload.documentRef,
        payloadRefs: { input: inputPayload.documentRef },
        summary: inputPayload.summary,
        tags: ["commander-console", command.commandType],
      }),
      commandId,
      envelopeKind: "human_command",
      from: "commander-console",
      to: "orchestration",
      commandType: command.commandType,
    },
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