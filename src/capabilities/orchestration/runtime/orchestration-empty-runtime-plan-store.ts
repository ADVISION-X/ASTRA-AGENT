import type { OrchestrationRuntimePlanStorePort } from "../ports/orchestration-runtime-plan-store-port.js";

export const EMPTY_ORCHESTRATION_RUNTIME_PLAN_STORE: OrchestrationRuntimePlanStorePort = {
  async getMap() {
    return null;
  },
  async getActiveMapRecord() {
    return null;
  },
  async listMaps() {
    return [];
  },
};