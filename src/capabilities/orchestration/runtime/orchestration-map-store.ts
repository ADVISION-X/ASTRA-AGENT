import type { OrchestrationMapStorePort } from "../ports/orchestration-map-store-port.js";
import type { MapPluginRegistry } from "../../../map-plugins/registry/map-plugin-registry.js";

function createRegistryLookupMethods(registry: MapPluginRegistry): Omit<OrchestrationMapStorePort, "listMaps"> {
  return {
    async getMap(mapId) {
      return registry.active.getOperationalMap(mapId);
    },
    async getActiveMapRecord(mapId) {
      return registry.active.getActiveOperationalMapRecord(mapId);
    },
    async getActiveMapRecordByTaskTemplateId(taskTemplateId) {
      return registry.active.getActiveOperationalMapRecordByTaskTemplateId(taskTemplateId);
    },
    async getActiveMapRecordByActivationId(activationId) {
      return registry.active.getActiveOperationalMapRecordByActivationId(activationId);
    },
  };
}

function createRegistryListMethods(registry: MapPluginRegistry): Pick<OrchestrationMapStorePort, "listMaps"> {
  return {
    async listMaps() {
      return registry.active.listActivePackages().map((mapPackage) => {
        const { mapVersion: _mapVersion, proofPolicy: _proofPolicy, ...operationalMap } = mapPackage.operationalMap;
        return operationalMap;
      });
    },
  };
}

export function createRegistryBackedMapStore(registry: MapPluginRegistry): OrchestrationMapStorePort {
  return {
    ...createRegistryLookupMethods(registry),
    ...createRegistryListMethods(registry),
  };
}