import { getDefaultMapPluginRegistry } from "../../../map-plugins/registry/map-plugin-registry.js";
import { createRegistryBackedMapStore } from "./orchestration-map-store.js";

export function createDefaultOrchestrationMapStore() {
  return createRegistryBackedMapStore(getDefaultMapPluginRegistry());
}