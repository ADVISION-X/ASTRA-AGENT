import type { MissionState } from "../contract.js";
import type { ActiveOperationalMapRecord, OrchestrationMapStorePort } from "../ports/orchestration-map-store-port.js";

export function buildRunLockId(missionId: string, isoTimestamp: string): string {
  return `${missionId}:run-lock:${isoTimestamp}`;
}

export function buildCancellationTokenRef(missionId: string, runLockId: string): string {
  return `${missionId}:cancel:${runLockId}`;
}

export function buildResumeCheckpointRef(state: MissionState): string {
  return `${state.missionId ?? "unknown-mission"}:checkpoint:${state.sequenceNo}:${state.stateRevision}`;
}

export function createActivationSnapshotRef(record: ActiveOperationalMapRecord): string {
  return record.activationSnapshotRef;
}

export function toFrozenActivationState(record: ActiveOperationalMapRecord) {
  return {
    taskTemplateId: record.taskTemplateId,
    activationId: record.activationId,
    mapPackageId: record.packageId,
    mapPackageVersion: record.packageVersion,
    selectedMapVersion: record.mapVersion,
    activationSnapshotRef: createActivationSnapshotRef(record),
    promptContractVersion: record.promptContractVersion,
    capabilityCatalogVersion: record.capabilityCatalogVersion,
  };
}

export async function resolveFrozenActivationMapRecord(
  mapStore: OrchestrationMapStorePort,
  state: MissionState,
): Promise<ActiveOperationalMapRecord | null> {
  if (!state.activationId) {
    return null;
  }
  return mapStore.getActiveMapRecordByActivationId(state.activationId);
}