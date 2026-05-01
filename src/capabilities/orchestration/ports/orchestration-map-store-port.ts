import type { OperationalMap, OperationalMapId } from "../contract.js";

export type ActiveOperationalMapRecord = {
  mapId: OperationalMapId;
  taskTemplateId: string;
  packageId: string;
  packageVersion: string;
  mapVersion: string;
  activationId: string;
  activationSnapshotRef: string;
  capabilityCatalogVersion: string | null;
  promptContractVersion: string | null;
  requestedPlatformId: string | null;
  platformProfileRef: string | null;
  targetProfileRef: string | null;
  operationalMap: OperationalMap;
};

export interface OrchestrationMapStorePort {
  getMap(mapId: OperationalMapId): Promise<OperationalMap | null>;
  getActiveMapRecord(mapId: OperationalMapId): Promise<ActiveOperationalMapRecord | null>;
  getActiveMapRecordByTaskTemplateId(taskTemplateId: string): Promise<ActiveOperationalMapRecord | null>;
  getActiveMapRecordByActivationId(activationId: string): Promise<ActiveOperationalMapRecord | null>;
  listMaps(): Promise<readonly OperationalMap[]>;
}