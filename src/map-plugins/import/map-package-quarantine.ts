import type { MapPluginRegistry } from "../registry/map-plugin-registry.js";

export function listQuarantinedMapPackages(registry: MapPluginRegistry) {
  return registry.quarantined.list();
}
