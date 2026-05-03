import type { WorkbenchRuntime } from "./workbench-contract.js";
import {
  buildMirroredEnvelopeBase,
  buildPayloadDocument,
  payloadDocumentToObject,
  payloadValueToInteger,
  payloadValueToString,
} from "./workbench-payload.js";
import type { WorkbenchNerveBusHandledResult as NerveBusHandledResult } from "./workbench-nerve-bus-types.js";
import type { HumanCommandEnvelope, HumanCommandResultEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";

type HumanCommandStatus = "success" | "failed" | "review_required";

type HumanCommandHandledResult = {
  envelope: HumanCommandResultEnvelope;
  outputPayload: ReturnType<typeof buildPayloadDocument>;
};

type HumanCommandPayloadDocument = ReturnType<typeof buildPayloadDocument>;

const throwIfAborted = (signal: AbortSignal) => {
  if (signal.aborted) {
    throw new Error(typeof signal.reason === "string" ? signal.reason : "Transport aborted before human command completion.");
  }
};

const buildHumanCommandResultEnvelope = (input: {
  envelope: HumanCommandEnvelope;
  status: HumanCommandStatus;
  summary: string;
  failureReason?: string | null;
}): HumanCommandHandledResult => {
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
      ...buildMirroredEnvelopeBase({
        channelId: "orchestration-to-commander",
        envelopeId: `${input.envelope.envelopeId}:result`,
        requestEnvelope: input.envelope,
        payloadRefs: { output: outputPayload.documentRef },
        summary: outputPayload.summary,
        tags: ["commander-console", input.status],
      }),
      resultId: `${input.envelope.commandId}:result`,
      envelopeKind: "human_command_result",
      from: "orchestration",
      to: "commander-console",
      correlationEnvelopeId: input.envelope.envelopeId,
      correlationCapabilityCallId: input.envelope.capabilityCallId,
      correlationInputRef: input.envelope.inputRef,
      proofRef: `${input.envelope.envelopeId}:result:proof`,
      status: input.status,
      outputRef: input.status === "success" ? outputPayload.documentRef : null,
      diagnosticPayloadRef: input.status === "success" ? null : outputPayload.documentRef,
      failureReason: input.status === "failed" ? input.failureReason ?? "human command failed" : null,
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
  const requestedPlatformId = payloadValueToString(payload.requestedPlatformId);
  if (!requestedPlatformId) {
    return buildHumanCommandResultEnvelope({ envelope, status: "failed", summary: "requestedPlatformId is required for start-mission.", failureReason: "requestedPlatformId is required for start-mission." });
  }
  const parsedSelectedMapId = payloadValueToString(payload.selectedMapId);
  const missionState = await runtime.orchestrationAbilityGroup.startMission({
    missionId: envelope.missionId,
    humanGoal: payloadValueToString(payload.humanGoal) ?? "Discover evidence-backed product opportunities from the active social feed.",
    requestedPlatform: requestedPlatformId,
    preferredMapId: parsedSelectedMapId,
    taskTemplateId: payloadValueToString(payload.taskTemplateId),
    activationId: payloadValueToString(payload.activationId),
    maxRounds: payloadValueToInteger(payload.maxRounds),
    maxMinutes: payloadValueToInteger(payload.maxMinutes),
    initialPayload: {
      requestedBy: "commander-console",
      selectedMapId: parsedSelectedMapId,
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

const routeMissionCommand = (
  runtime: WorkbenchRuntime,
  envelope: HumanCommandEnvelope,
  payload: Record<string, string | number | boolean | null>,
): Promise<HumanCommandHandledResult> => {
  switch (envelope.commandType) {
    case "start-mission":
      return handleStartMission(runtime, envelope, payload);
    case "pause-mission":
    case "resume-mission":
    case "stop-mission":
    case "emergency-stop":
      return handleMissionControl(runtime, envelope, payloadValueToString(payload.operatorNote));
    default:
      return Promise.resolve(buildHumanCommandResultEnvelope({ envelope, status: "failed", summary: `Unsupported mission command: ${envelope.commandType}.`, failureReason: `Unsupported mission command: ${envelope.commandType}.` }));
  }
};

const routeCandidateCommand = (
  runtime: WorkbenchRuntime,
  envelope: HumanCommandEnvelope,
  payload: Record<string, string | number | boolean | null>,
): Promise<HumanCommandHandledResult> => {
  switch (envelope.commandType) {
    case "approve-candidate":
    case "reject-candidate":
    case "mark-review-required":
    case "hold-candidate":
      return handleCandidateReview(runtime, envelope, payload);
    default:
      return Promise.resolve(buildHumanCommandResultEnvelope({ envelope, status: "failed", summary: `Unsupported candidate command: ${envelope.commandType}.`, failureReason: `Unsupported candidate command: ${envelope.commandType}.` }));
  }
};

const routeHumanCommand = (
  runtime: WorkbenchRuntime,
  envelope: HumanCommandEnvelope,
  payload: Record<string, string | number | boolean | null>,
): Promise<HumanCommandHandledResult> => {
  if (
    envelope.commandType === "start-mission"
    || envelope.commandType === "pause-mission"
    || envelope.commandType === "resume-mission"
    || envelope.commandType === "stop-mission"
    || envelope.commandType === "emergency-stop"
  ) {
    return routeMissionCommand(runtime, envelope, payload);
  }
  return routeCandidateCommand(runtime, envelope, payload);
};

export const handleHumanCommandEnvelope = async (
  runtime: WorkbenchRuntime,
  envelope: HumanCommandEnvelope,
  inputPayload: HumanCommandPayloadDocument,
  signal: AbortSignal,
): Promise<NerveBusHandledResult<HumanCommandResultEnvelope>> => {
  try {
    throwIfAborted(signal);
    const payload = payloadDocumentToObject(inputPayload);
    const result = await routeHumanCommand(runtime, envelope, payload);
    throwIfAborted(signal);
    return result;
  } catch (error) {
    return buildHumanCommandResultEnvelope({
      envelope,
      status: "failed",
      summary: "Unknown human command transport failure",
      failureReason: error instanceof Error ? error.message : "Unknown human command transport failure",
    });
  }
};