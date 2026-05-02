import type { OrchestrationMapStorePort } from "../ports/orchestration-map-store-port.js";
import type { MapPluginRegistry } from "../../../map-plugins/registry/map-plugin-registry.js";

function toMapStoreRecord(record: ReturnType<MapPluginRegistry["active"]["getActiveOperationalMapRecord"]>) {
  if (!record) {
    return null;
  }

  return {
    mapId: record.mapId,
    taskTemplateId: record.taskTemplateId,
    packageId: record.packageId,
    packageVersion: record.packageVersion,
    mapVersion: record.mapVersion,
    activationId: record.activationId,
    activationSnapshotRef: record.activationSnapshotRef,
    capabilityCatalogVersion: record.capabilityCatalogVersion,
    promptContractVersion: record.promptCatalogVersion,
    requestedPlatformId: record.requestedPlatformId,
    platformProfileRef: record.platformProfileRef,
    targetProfileRef: record.targetProfileRef,
    operationalMap: record.operationalMap,
  };
}

function createRegistryLookupMethods(registry: MapPluginRegistry): Omit<OrchestrationMapStorePort, "listMaps"> {
  return {
    async getMap(mapId) {
      return registry.active.getOperationalMap(mapId);
    },
    async getActiveMapRecord(mapId) {
      return toMapStoreRecord(registry.active.getActiveOperationalMapRecord(mapId));
    },
    async getActiveMapRecordByTaskTemplateId(taskTemplateId) {
      return toMapStoreRecord(registry.active.getActiveOperationalMapRecordByTaskTemplateId(taskTemplateId));
    },
    async getActiveMapRecordByActivationId(activationId) {
      return toMapStoreRecord(registry.active.getActiveOperationalMapRecordByActivationId(activationId));
    },
  };
}

function createRegistryListMethods(registry: MapPluginRegistry): Pick<OrchestrationMapStorePort, "listMaps"> {
  return {
    async listMaps() {
      return registry.active.listActiveOperationalMapRecords().map((record) => record.operationalMap);
    },
  };
}

export function createRegistryBackedMapStore(registry: MapPluginRegistry): OrchestrationMapStorePort {
  return {
    ...createRegistryLookupMethods(registry),
    ...createRegistryListMethods(registry),
  };
}