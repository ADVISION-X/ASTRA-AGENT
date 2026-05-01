import { getDefaultMapPluginRegistry } from "../../../map-plugins/registry/map-plugin-registry.js";
import type { OperationalMapId } from "../contract.js";

export function listActiveOrchestrationMapIds(): OperationalMapId[] {
  return getDefaultMapPluginRegistry()
    .active
    .listActivePackages()
    .map((mapPackage) => mapPackage.manifest.mapId);
}