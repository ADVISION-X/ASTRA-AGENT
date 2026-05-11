import type { OperationalMap, OperationalMapId } from "../contract.js";

export type ActiveOperationalMapRecord = {
  mapId: OperationalMapId;
  capabilityCatalogVersion: string | null;
  promptContractVersion: string | null;
  requestedPlatformId: string | null;
  platformProfileRef: string | null;
  targetProfileRef: string | null;
  missionFlow: OperationalMap;
};

export interface OrchestrationMapStorePort {
  getMap(mapId: OperationalMapId): Promise<OperationalMap | null>;
  getActiveMapRecord(mapId: OperationalMapId): Promise<ActiveOperationalMapRecord | null>;
  listMaps(): Promise<readonly OperationalMap[]>;
}