import type { OrchestrationMapStorePort } from "../ports/orchestration-map-store-port.js";

import { EMPTY_ORCHESTRATION_MAP_STORE } from "./orchestration-empty-map-store.js";

export function createRegistryBackedMapStore(_registry: unknown): OrchestrationMapStorePort {
  return EMPTY_ORCHESTRATION_MAP_STORE;
}