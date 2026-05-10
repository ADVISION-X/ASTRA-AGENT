import type { OrchestrationMapStorePort } from "../ports/orchestration-map-store-port.js";

export const EMPTY_ORCHESTRATION_MAP_STORE: OrchestrationMapStorePort = {
  async getMap() {
    return null;
  },
  async getActiveMapRecord() {
    return null;
  },
  async getActiveMapRecordByTaskTemplateId() {
    return null;
  },
  async getActiveMapRecordByActivationId() {
    return null;
  },
  async listMaps() {
    return [];
  },
};