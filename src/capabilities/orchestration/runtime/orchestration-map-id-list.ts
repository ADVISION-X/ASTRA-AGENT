import { getDefaultMapPluginRegistry as getGovernedMapPluginRegistry } from "../../../map-plugins/registry/map-plugin-registry.js";
import type { OperationalMapId } from "../contract.js";

type OrchestrationMapPluginRegistry = ReturnType<typeof getGovernedMapPluginRegistry>;
type OrchestrationActiveRegistry = OrchestrationMapPluginRegistry["active"];
type ActiveMapPackage = ReturnType<OrchestrationActiveRegistry["listActivePackages"]>[number];

export function getDefaultMapPluginRegistry(): OrchestrationMapPluginRegistry {
  return getGovernedMapPluginRegistry();
}

export function listActivePackages(registry: OrchestrationActiveRegistry = getDefaultMapPluginRegistry().active): ActiveMapPackage[] {
  return registry.listActivePackages();
}

export function listActiveOrchestrationMapIds(): OperationalMapId[] {
  return listActivePackages()
    .map((mapPackage) => mapPackage.manifest.mapId);
}