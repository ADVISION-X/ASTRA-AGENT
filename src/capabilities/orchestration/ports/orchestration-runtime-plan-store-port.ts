import type { RuntimePlan, RuntimePlanId } from "../contract.js";

export type ActiveRuntimePlanRecord = {
  mapId: RuntimePlanId;
  capabilityCatalogVersion: string | null;
  promptContractVersion: string | null;
  requestedPlatformId: string | null;
  platformProfileRef: string | null;
  targetProfileRef: string | null;
  missionFlow: RuntimePlan;
};

export interface OrchestrationRuntimePlanStorePort {
  getMap(mapId: RuntimePlanId): Promise<RuntimePlan | null>;
  getActiveMapRecord(mapId: RuntimePlanId): Promise<ActiveRuntimePlanRecord | null>;
  listMaps(): Promise<readonly RuntimePlan[]>;
}