import type { OrchestrationRuntimePlanStorePort } from "../ports/orchestration-runtime-plan-store-port.js";

import { EMPTY_ORCHESTRATION_RUNTIME_PLAN_STORE } from "./orchestration-empty-runtime-plan-store.js";

export function createDefaultOrchestrationRuntimePlanStore(): OrchestrationRuntimePlanStorePort {
  return EMPTY_ORCHESTRATION_RUNTIME_PLAN_STORE;
}