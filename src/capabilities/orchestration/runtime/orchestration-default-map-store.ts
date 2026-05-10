import type { OrchestrationMapStorePort } from "../ports/orchestration-map-store-port.js";

export function createDefaultOrchestrationMapStore(): OrchestrationMapStorePort {
  return {
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
}