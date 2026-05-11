import type { MissionCommand, MissionState, OperationalMap } from "../contract.js";
import { PayloadRefBundleSchema } from "../schema.js";
import { buildMissionStateUpdate } from "./orchestration-result-builder.js";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";

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
    activeTaskRunId: command.runId,
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
      selectedBindingId: map.mapId,
      operatorNote: command.initialPayload.operatorNote,
      targetUrl: command.initialPayload.targetUrl,
      targetTitle: command.initialPayload.targetTitle,
      targetProfileRef: command.initialPayload.targetProfileRef,
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

export function toMissionControlState(state: MissionState, updatedAt: string, updates: Partial<MissionState>): MissionState {
  return buildMissionStateUpdate({
    ...state,
    ...updates,
    updatedAt,
    stateRevision: (state.stateRevision ?? 0) + 1,
  });
}

export function createEmptyPayloadRefs() {
  return PayloadRefBundleSchema.parse({});
}

export function toRuntimeProofStatus(status: MissionState["status"]): "completed" | "failed" | "review_required" | "stopped" {
  if (status === "failed" || status === "review_required" || status === "completed" || status === "stopped") {
    return status;
  }
  return status === "running" ? "completed" : "stopped";
}

export function toMapProofMetadata(record: ActiveOperationalMapRecord | null | undefined) {
  return {
    taskBindingId: record?.taskBindingId ?? null,
    bindingActivationRef: record?.bindingActivationRef ?? null,
    bindingPackageId: record?.packageId ?? null,
    bindingPackageVersion: record?.packageVersion ?? null,
    mapVersion: record?.mapVersion ?? null,
    bindingVersion: record?.mapVersion ?? null,
    bindingSnapshotRef: record?.bindingSnapshotRef ?? null,
    promptContractVersion: record?.promptContractVersion ?? null,
    capabilityCatalogVersion: record?.capabilityCatalogVersion ?? null,
  };
}
