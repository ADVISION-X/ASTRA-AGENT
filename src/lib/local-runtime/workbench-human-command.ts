import type { WorkbenchRuntime } from "./workbench-contract.js";
import {
  buildPayloadDocument,
  payloadDocumentToObject,
  payloadValueToString,
} from "./workbench-payload.js";
import {
  buildHumanCommandResultEnvelope,
  handleStartMission,
  type HumanCommandHandledResult,
} from "./workbench-human-command-start-mission.js";
import type { WorkbenchNerveBusHandledResult as NerveBusHandledResult } from "./workbench-nerve-bus-types.js";
import type { HumanCommandEnvelope, HumanCommandResultEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";

const throwIfAborted = (signal: AbortSignal) => {
  if (signal.aborted) {
    throw new Error(typeof signal.reason === "string" ? signal.reason : "Transport aborted before human command completion.");
  }
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
  const candidate = await runtime.evidenceStore.setCandidateDisposition(candidateId, "hold", payloadValueToString(payload.operatorNote) ?? undefined);
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
    case "mark-review-required":
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
  inputPayload: ReturnType<typeof buildPayloadDocument>,
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
