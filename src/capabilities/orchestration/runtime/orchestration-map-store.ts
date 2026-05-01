import type { OrchestrationMapStorePort } from "../ports/orchestration-map-store-port.js";
import type { MapPluginRegistry } from "../../../map-plugins/registry/map-plugin-registry.js";

function buildActivationSnapshotRef(activationId: string, mapVersion: string, packageVersion: string): string {
  return `activation-snapshot:${activationId}:${packageVersion}:${mapVersion}`;
}

function toActiveOperationalMapRecord(registry: MapPluginRegistry, mapId: string) {
  const registration = registry.active.getRegistration(mapId);
  if (!registration) {
    return null;
  }

  return {
    mapId: registration.mapPackage.manifest.mapId,
    taskTemplateId: registration.mapPackage.taskTemplate.taskTemplateId,
    packageId: registration.mapPackage.manifest.packageId,
    packageVersion: registration.mapPackage.manifest.packageVersion,
    mapVersion: registration.mapPackage.operationalMap.mapVersion,
    activationId: registration.activationRecord.activationId,
    activationSnapshotRef: buildActivationSnapshotRef(
      registration.activationRecord.activationId,
      registration.mapPackage.operationalMap.mapVersion,
      registration.mapPackage.manifest.packageVersion,
    ),
    capabilityCatalogVersion: registration.activationRecord.capabilityCatalogVersion,
    promptContractVersion: registration.activationRecord.promptCatalogVersion,
    requestedPlatformId: registration.mapPackage.taskTemplate.requestedPlatformId,
    platformProfileRef: registration.mapPackage.taskTemplate.platformProfileRef,
    targetProfileRef: registration.mapPackage.taskTemplate.targetProfileRef,
    operationalMap: (() => {
      const { mapVersion: _mapVersion, proofPolicy: _proofPolicy, ...operationalMap } = registration.mapPackage.operationalMap;
      return operationalMap;
    })(),
  };
}

function createRegistryLookupMethods(registry: MapPluginRegistry): Omit<OrchestrationMapStorePort, "listMaps"> {
  return {
    async getMap(mapId) {
      return registry.active.getOperationalMap(mapId);
    },
    async getActiveMapRecord(mapId) {
      return toActiveOperationalMapRecord(registry, mapId);
    },
    async getActiveMapRecordByTaskTemplateId(taskTemplateId) {
      const record = registry.active.getActiveOperationalMapRecordByTaskTemplateId(taskTemplateId);
      return record ? toActiveOperationalMapRecord(registry, record.mapId) : null;
    },
    async getActiveMapRecordByActivationId(activationId) {
      const record = registry.active.getActiveOperationalMapRecordByActivationId(activationId);
      return record ? toActiveOperationalMapRecord(registry, record.mapId) : null;
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