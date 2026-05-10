import type { OperationalMapId } from "../contract.js";

type ActiveMapPackage = { manifest: { mapId: OperationalMapId } };

type OrchestrationActiveRegistry = {
  listActivePackages(): ActiveMapPackage[];
  getRegistration(_mapId: OperationalMapId): null;
};

type OrchestrationMapPluginRegistry = {
  active: OrchestrationActiveRegistry;
};

export function getDefaultMapPluginRegistry(): OrchestrationMapPluginRegistry {
  return {
    active: {
      listActivePackages() {
        return [];
      },
      getRegistration() {
        return null;
      },
    },
  };
}

export function listActivePackages(registry: OrchestrationActiveRegistry = getDefaultMapPluginRegistry().active): ActiveMapPackage[] {
  return registry.listActivePackages();
}

export function listActiveOrchestrationMapIds(): OperationalMapId[] {
  return listActivePackages()
    .map((mapPackage) => mapPackage.manifest.mapId);
}