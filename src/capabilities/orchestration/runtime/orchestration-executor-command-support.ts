import type { MissionCommand, MissionState } from "../contract.js";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";
import { PayloadRefBundleSchema } from "../schema.js";
import { buildMissionStateUpdate } from "./orchestration-result-builder.js";
import { buildCancellationTokenRef, buildRunLockId, toFrozenActivationState } from "./orchestration-frozen-activation.js";

export const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

export function createEmptyPayloadRefs() {
  return PayloadRefBundleSchema.parse({});
}

function buildInitialPayloadRefs(command: MissionCommand, mapRecord: ActiveOperationalMapRecord) {
  return PayloadRefBundleSchema.parse({
    requestedPlatformId: command.requestedPlatform,
    selectedMapId: mapRecord.mapId,
    operatorNote: command.initialPayload.operatorNote,
    targetUrl: command.initialPayload.targetUrl,
    targetTitle: command.initialPayload.targetTitle,
    targetProfileRef: command.initialPayload.targetProfileRef,
    sourceEvidenceRef: command.initialPayload.sourceEvidenceRef,
    sourceTargetRef: command.initialPayload.sourceTargetRef,
    promptInputRef: command.initialPayload.promptInputRef,
    commandInputRef: command.initialPayload.commandInputRef,
  });
}

function buildInitialMissionRuntimeState(
  command: MissionCommand,
  mapRecord: ActiveOperationalMapRecord,
  selectedMapSource: MissionState["selectedMapSource"],
  startedAt: string,
) {
  const runLockId = buildRunLockId(command.missionId, startedAt);
  return {
    ...toFrozenActivationState(mapRecord),
    selectedMapSource,
    requestedPlatform: command.requestedPlatform,
    humanGoal: command.humanGoal,
    configuredMaxRounds: command.maxRounds ?? null,
    configuredMaxMinutes: command.maxMinutes ?? null,
    status: "running" as const,
    currentStepId: mapRecord.operationalMap.initialStepId,
    previousStepId: null,
    activeTaskRunId: command.runId,
    currentRoundIndex: 0,
    sequenceNo: 0,
    stateRevision: 0,
    hopCount: 0,
    reviewRequiredReason: null,
    failureReason: null,
    lastHumanCommand: "start-mission" as const,
    lastEnvelopeId: null,
    lastResultRef: null,
    lastRuntimeProofRef: null,
    runtimeProofRefs: [],
    payloadRefs: buildInitialPayloadRefs(command, mapRecord),
    runLockId,
    cancellationTokenRef: buildCancellationTokenRef(command.missionId, runLockId),
    resumeCheckpointRef: null,
    emergencyStopLatched: false,
    startedAt,
    updatedAt: startedAt,
    pausedAt: null,
    endedAt: null,
  };
}

export function createFailedMissionState(input: {
  missionId: string | null;
  runId?: string | null;
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
    taskTemplateId: null,
    activationId: null,
    mapPackageId: null,
    mapPackageVersion: null,
    selectedMapVersion: null,
    activationSnapshotRef: null,
    promptContractVersion: null,
    capabilityCatalogVersion: null,
    selectedMapSource: null,
    requestedPlatform: input.requestedPlatform,
    humanGoal: input.humanGoal,
    status: "failed",
    currentStepId: null,
    previousStepId: null,
    activeTaskRunId: input.runId ?? (input.missionId ? `${input.missionId}:failure-run` : "orchestration:unknown-mission:failure-run"),
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
    runLockId: null,
    cancellationTokenRef: null,
    resumeCheckpointRef: null,
    emergencyStopLatched: false,
    startedAt: input.startedAt,
    updatedAt: input.startedAt,
    pausedAt: null,
    endedAt: input.endedAt,
  });
}

export function createInitialMissionState(
  command: MissionCommand,
  mapRecord: ActiveOperationalMapRecord,
  selectedMapSource: MissionState["selectedMapSource"],
  startedAt: string,
): MissionState {
  return buildMissionStateUpdate({
    missionId: command.missionId,
    mapId: mapRecord.mapId,
    ...buildInitialMissionRuntimeState(command, mapRecord, selectedMapSource, startedAt),
  });
}
