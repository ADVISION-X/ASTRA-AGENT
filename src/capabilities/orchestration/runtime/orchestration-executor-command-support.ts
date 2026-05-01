import type { MissionCommand, MissionState, OperationalMap } from "../contract.js";
import { PayloadRefBundleSchema } from "../schema.js";
import { buildMissionStateUpdate } from "./orchestration-result-builder.js";

export const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

export function createEmptyPayloadRefs() {
  return PayloadRefBundleSchema.parse({});
}

export function createFailedMissionState(input: {
  missionId: string | null;
  mapId: string | null;
  requestedPlatform: MissionState["requestedPlatform"];
  humanGoal: string | null;
  lastHumanCommand: "start-mission" | "resume-mission";
  failureReason: string | null;
  startedAt: string;
  endedAt: string;
}): MissionState {
  return buildMissionStateUpdate({
    missionId: input.missionId,
    mapId: input.mapId,
    requestedPlatform: input.requestedPlatform,
    humanGoal: input.humanGoal,
    status: "failed",
    currentStepId: null,
    previousStepId: null,
    activeTaskRunId: null,
    currentRoundIndex: 0,
    sequenceNo: 0,
    hopCount: 0,
    reviewRequiredReason: null,
    failureReason: input.failureReason,
    lastHumanCommand: input.lastHumanCommand,
    lastEnvelopeId: null,
    lastResultRef: null,
    lastRuntimeProofRef: null,
    runtimeProofRefs: [],
    payloadRefs: createEmptyPayloadRefs(),
    emergencyStopLatched: false,
    startedAt: input.startedAt,
    updatedAt: input.startedAt,
    pausedAt: null,
    endedAt: input.endedAt,
  });
}

export function createInitialMissionState(command: MissionCommand, map: OperationalMap, startedAt: string): MissionState {
  return buildMissionStateUpdate({
    missionId: command.missionId,
    mapId: map.mapId,
    requestedPlatform: command.requestedPlatform,
    humanGoal: command.humanGoal,
    configuredMaxRounds: command.maxRounds ?? null,
    configuredMaxMinutes: command.maxMinutes ?? null,
    status: "running",
    currentStepId: map.initialStepId,
    previousStepId: null,
    activeTaskRunId: `${command.missionId}:${map.mapId}`,
    currentRoundIndex: 0,
    sequenceNo: 0,
    stateRevision: 0,
    hopCount: 0,
    reviewRequiredReason: null,
    failureReason: null,
    lastHumanCommand: "start-mission",
    lastEnvelopeId: null,
    lastResultRef: null,
    lastRuntimeProofRef: null,
    runtimeProofRefs: [],
    payloadRefs: PayloadRefBundleSchema.parse({
      requestedPlatformId: command.requestedPlatform,
      selectedMapId: map.mapId,
      operatorNote: command.initialPayload.operatorNote,
      targetUrl: command.initialPayload.targetUrl,
      targetTitle: command.initialPayload.targetTitle,
      sourceEvidenceRef: command.initialPayload.sourceEvidenceRef,
      sourceTargetRef: command.initialPayload.sourceTargetRef,
      promptInputRef: command.initialPayload.promptInputRef,
      commandInputRef: command.initialPayload.commandInputRef,
    }),
    emergencyStopLatched: false,
    startedAt,
    updatedAt: startedAt,
    pausedAt: null,
    endedAt: null,
  });
}
