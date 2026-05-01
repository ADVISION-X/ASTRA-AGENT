import {
  OperationalMapIdSchema,
} from "../../capabilities/orchestration/schema.js";
import type { RequestedPlatformId } from "../../capabilities/orchestration/contract.js";
import type { CommanderHumanCommandEnvelope } from "../../capabilities/commander-console/contract.js";
import type {
  HumanCommandEnvelope,
  HumanCommandResultEnvelope,
} from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { HumanCommandDispatchInput } from "../../capabilities/nerve-bus/contract.js";
import type { NerveBusHandledResult } from "../../capabilities/nerve-bus/ports/nerve-bus-handler-port.js";
import type { NerveBusPayloadDocument } from "../../capabilities/nerve-bus/ports/nerve-bus-transport-port.js";
import { createId } from "./ids.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import { buildPayloadDocument, buildTransportEnvelopeBase, payloadDocumentToObject, payloadValueToInteger, payloadValueToString } from "./workbench-payload.js";

const buildHumanCommandResultEnvelope = (input: {
  envelope: HumanCommandEnvelope;
  status: "success" | "failed" | "review_required";
  summary: string;
  failureReason?: string | null;
}): NerveBusHandledResult<HumanCommandResultEnvelope> => {
  const outputPayload = buildPayloadDocument({
    documentType: "human.command.result",
    documentRef: `${input.envelope.commandId}:result`,
    summary: input.summary,
    content: {
      commandType: input.envelope.commandType,
      missionId: input.envelope.missionId,
      failureReason: input.failureReason ?? null,
      status: input.status,
    },
  });
  return {
    envelope: {
      ...buildTransportEnvelopeBase({
        channelId: "orchestration-to-commander",
        envelopeId: `${input.envelope.envelopeId}:result`,
        missionId: input.envelope.missionId,
        mapId: input.envelope.mapId,
        stepId: input.envelope.stepId,
        inputRef: input.envelope.inputRef,
        payloadRefs: { output: outputPayload.documentRef },
        summary: outputPayload.summary,
        tags: ["commander-console", input.status],
      }),
      resultId: `${input.envelope.commandId}:result`,
      envelopeKind: "human_command_result",
      from: "orchestration",
      to: "commander-console",
      status: input.status,
      outputRef: outputPayload.documentRef,
      diagnosticPayloadRef: null,
      failureReason: input.failureReason ?? null,
      reviewRequiredReason: input.status === "review_required" ? input.failureReason ?? "review required" : null,
    },
    outputPayload,
  };
};

const resolveHumanCommandMissionId = async (
  runtime: WorkbenchRuntime,
  envelope: HumanCommandEnvelope,
): Promise<string> => {
  const currentMission = await runtime.orchestrationAbilityGroup.getMissionState();
  const missionId = envelope.missionId !== "human-command" ? envelope.missionId : currentMission.missionId;
  if (!missionId) {
    throw new Error("No active mission is available.");
  }
  return missionId;
};

const handleStartMission = async (
  runtime: WorkbenchRuntime,
  envelope: HumanCommandEnvelope,
  payload: Record<string, string | number | boolean | null>,
) => {
  const requestedPlatformId = payloadValueToString(payload.requestedPlatformId) as RequestedPlatformId | null;
  if (!requestedPlatformId) {
    return buildHumanCommandResultEnvelope({ envelope, status: "failed", summary: "requestedPlatformId is required for start-mission.", failureReason: "requestedPlatformId is required for start-mission." });
  }
  const parsedSelectedMapId = typeof payload.selectedMapId === "string"
    ? OperationalMapIdSchema.safeParse(payload.selectedMapId)
    : null;
  const missionState = await runtime.orchestrationAbilityGroup.startMission({
    missionId: envelope.missionId,
    humanGoal: payloadValueToString(payload.humanGoal) ?? "Discover evidence-backed product opportunities from the active social feed.",
    requestedPlatform: requestedPlatformId,
    preferredMapId: parsedSelectedMapId?.success ? parsedSelectedMapId.data : null,
    taskTemplateId: payloadValueToString(payload.taskTemplateId),
    activationId: payloadValueToString(payload.activationId),
    maxRounds: payloadValueToInteger(payload.maxRounds),
    maxMinutes: payloadValueToInteger(payload.maxMinutes),
    initialPayload: {
      requestedBy: "commander-console",
      selectedMapId: parsedSelectedMapId?.success ? parsedSelectedMapId.data : null,
      maxRounds: payloadValueToInteger(payload.maxRounds),
      maxMinutes: payloadValueToInteger(payload.maxMinutes),
      operatorNote: payloadValueToString(payload.operatorNote),
      targetUrl: null,
      targetTitle: null,
      sourceEvidenceRef: null,
      sourceTargetRef: null,
      promptInputRef: null,
      commandInputRef: null,
    },
  });
  return buildHumanCommandResultEnvelope({
    envelope,
    status: missionState.status === "review_required" ? "review_required" : "success",
    summary: `Mission ${missionState.missionId ?? envelope.missionId} is now ${missionState.status}.`,
  });
};

const handleMissionControl = async (
  runtime: WorkbenchRuntime,
  envelope: HumanCommandEnvelope,
  operatorNote: string | null,
) => {
  const missionId = await resolveHumanCommandMissionId(runtime, envelope);
  switch (envelope.commandType) {
    case "pause-mission": {
      const missionState = await runtime.orchestrationAbilityGroup.pauseMission(missionId);
      return buildHumanCommandResultEnvelope({ envelope, status: "success", summary: `Mission ${missionId} is now ${missionState.status}.` });
    }
    case "resume-mission": {
      const missionState = await runtime.orchestrationAbilityGroup.resumeMission(missionId);
      return buildHumanCommandResultEnvelope({ envelope, status: missionState.status === "review_required" ? "review_required" : "success", summary: `Mission ${missionId} is now ${missionState.status}.` });
    }
    case "stop-mission": {
      const missionState = await runtime.orchestrationAbilityGroup.stopMission({ missionId, reason: operatorNote ?? "stop requested by commander console" });
      return buildHumanCommandResultEnvelope({ envelope, status: "success", summary: `Mission ${missionId} is now ${missionState.status}.` });
    }
    default: {
      const missionState = await runtime.orchestrationAbilityGroup.emergencyStop({ missionId, reason: operatorNote ?? "emergency stop requested by commander console" });
      return buildHumanCommandResultEnvelope({ envelope, status: "success", summary: `Mission ${missionId} is now ${missionState.status}.` });
    }
  }
};

const handleCandidateReview = async (
  runtime: WorkbenchRuntime,
  envelope: HumanCommandEnvelope,
  payload: Record<string, string | number | boolean | null>,
) => {
  const candidateId = payloadValueToString(payload.targetRecordId);
  if (candidateId === null) {
    return buildHumanCommandResultEnvelope({ envelope, status: "failed", summary: "Candidate review commands require a target candidate id.", failureReason: "Candidate review commands require a target candidate id." });
  }
  const disposition = envelope.commandType === "approve-candidate"
    ? "approve"
    : envelope.commandType === "reject-candidate"
      ? "reject"
      : "hold";
  const candidate = await runtime.evidenceStore.setCandidateDisposition(candidateId, disposition, payloadValueToString(payload.operatorNote) ?? undefined);
  return buildHumanCommandResultEnvelope({ envelope, status: "success", summary: `Candidate ${candidate.id} is now ${candidate.reviewStatus}.` });
};

export const handleHumanCommandEnvelope = async (
  runtime: WorkbenchRuntime,
  envelope: HumanCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
): Promise<NerveBusHandledResult<HumanCommandResultEnvelope>> => {
  try {
    const payload = payloadDocumentToObject(inputPayload);
    switch (envelope.commandType) {
      case "start-mission": return handleStartMission(runtime, envelope, payload);
      case "pause-mission":
      case "resume-mission":
      case "stop-mission":
      case "emergency-stop": return handleMissionControl(runtime, envelope, payloadValueToString(payload.operatorNote));
      case "approve-candidate":
      case "reject-candidate":
      case "mark-review-required":
      case "hold-candidate": return handleCandidateReview(runtime, envelope, payload);
      default: return buildHumanCommandResultEnvelope({ envelope, status: "failed", summary: `Unsupported human command: ${envelope.commandType}.`, failureReason: `Unsupported human command: ${envelope.commandType}.` });
    }
  } catch (error) {
    return buildHumanCommandResultEnvelope({
      envelope,
      status: "failed",
      summary: "Unknown human command transport failure",
      failureReason: error instanceof Error ? error.message : "Unknown human command transport failure",
    });
  }
};

export const buildHumanCommandDispatchInput = (
  command: CommanderHumanCommandEnvelope,
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
  } satisfies HumanCommandDispatchInput;
};

export const describeHumanCommandTransportMessage = (
  resultEnvelope: HumanCommandResultEnvelope,
): string => {
  if (resultEnvelope.status === "failed") {
    return resultEnvelope.failureReason ?? "command transport failed";
  }
  if (resultEnvelope.status === "review_required") {
    return resultEnvelope.failureReason ?? "command transport requires review";
  }
  return resultEnvelope.reviewRequiredReason ?? "command accepted";
};