import type { OperationalMap, OperationalMapId } from "../contract.js";

export interface OrchestrationMapStorePort {
  getMap(mapId: OperationalMapId): Promise<OperationalMap | null>;
  listMaps(): Promise<readonly OperationalMap[]>;
}