import type { MissionState } from "../contract.js";
import type { ActiveRuntimePlanRecord, OrchestrationRuntimePlanStorePort } from "../ports/orchestration-runtime-plan-store-port.js";

export function buildRunLockId(missionId: string, isoTimestamp: string): string {
  return `${missionId}:run-lock:${isoTimestamp}`;
}

export function buildCancellationTokenRef(missionId: string, runLockId: string): string {
  return `${missionId}:cancel:${runLockId}`;
}

export function buildResumeCheckpointRef(state: MissionState): string {
  return `${state.missionId ?? "unknown-mission"}:checkpoint:${state.sequenceNo}:${state.stateRevision}`;
}

export function toFrozenActivationState(record: ActiveRuntimePlanRecord) {
  return {
    promptContractVersion: record.promptContractVersion,
    capabilityCatalogVersion: record.capabilityCatalogVersion,
  };
}

export async function resolveFrozenActivationMapRecord(
  mapStore: OrchestrationRuntimePlanStorePort,
  state: MissionState,
): Promise<ActiveRuntimePlanRecord | null> {
  if (!state.mapId) {
    return null;
  }
  return mapStore.getActiveMapRecord(state.mapId);
}