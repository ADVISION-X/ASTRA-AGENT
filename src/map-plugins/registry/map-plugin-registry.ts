import { loadBuiltinMapPackages } from "../builtins/index.js";
import { activateMapPackage } from "../import/map-package-activation.js";
import { importMapPackage } from "../import/map-package-importer.js";
import { rollbackMapPackage } from "../import/map-package-rollback.js";
import { createActiveMapRegistry, type ActiveMapRegistry } from "./active-map-registry.js";
import { MapActivationRecordStore } from "./map-activation-record.js";
import { MapRollbackRecordStore } from "./map-rollback-record.js";
import { MapPackageVersionStore } from "./map-version-store.js";
import { createQuarantinedMapRegistry, type QuarantinedMapRegistry } from "./quarantined-map-registry.js";
import type { DeveloperMapPackageItem } from "../shared/map-package-registry-types.js";
import type { MapPackage } from "../shared/map-package-types.js";

const getLifecycleStatus = (
  mapPackage: MapPackage,
  activationId: string | null,
  isQuarantined: boolean,
): DeveloperMapPackageItem["lifecycleStatus"] => {
  if (activationId) {
    return "active";
  }
  if (mapPackage.manifest.approvalStatus === "draft") {
    return "draft";
  }
  return isQuarantined ? "quarantined" : "disabled";
};

const toDeveloperMapPackageItem = (registry: MapPluginRegistry, mapPackage: MapPackage): DeveloperMapPackageItem => {
  const activation = registry.active.getRegistration(mapPackage.manifest.mapId)?.activationRecord ?? null;
  const quarantined = registry.quarantined.get(mapPackage.manifest.packageId, mapPackage.manifest.packageVersion);
  return {
    packageId: mapPackage.manifest.packageId,
    packageVersion: mapPackage.manifest.packageVersion,
    mapId: mapPackage.manifest.mapId,
    title: mapPackage.taskTemplate.displayName,
    lifecycleStatus: getLifecycleStatus(mapPackage, activation?.activationId ?? null, Boolean(quarantined)),
    approvalStatus: mapPackage.manifest.approvalStatus,
    summary: mapPackage.taskTemplate.description,
    chain: mapPackage.operationalMap.allowedAbilityGroups,
    validationIssues: quarantined?.validationIssues ?? [],
    activationId: activation?.activationId ?? null,
    draftOnly: mapPackage.manifest.aiGenerated || mapPackage.taskTemplate.availabilityPolicy === "draft",
  };
};

const shouldActivateBuiltinPackage = (builtinPackage: MapPackage): boolean =>
  builtinPackage.manifest.approvalStatus === "approved" && builtinPackage.taskTemplate.availabilityPolicy === "active";

export type MapPluginRegistry = {
  versions: MapPackageVersionStore;
  quarantined: QuarantinedMapRegistry;
  active: ActiveMapRegistry;
  activations: MapActivationRecordStore;
  rollbacks: MapRollbackRecordStore;
  importPackage(rawPackage: unknown, importedBy: string): ReturnType<typeof importMapPackage>;
  activatePackage(packageId: string, packageVersion: string, approvedBy: string, reason: string): ReturnType<typeof activateMapPackage>;
  rollbackActiveMap(mapId: string, rolledBackBy: string, reason: string): ReturnType<typeof rollbackMapPackage>;
  listDeveloperCatalog(): DeveloperMapPackageItem[];
};

export const createMapPluginRegistry = (): MapPluginRegistry => {
  const registry: MapPluginRegistry = {
    versions: new MapPackageVersionStore(),
    quarantined: createQuarantinedMapRegistry(),
    active: createActiveMapRegistry(),
    activations: new MapActivationRecordStore(),
    rollbacks: new MapRollbackRecordStore(),
    importPackage(rawPackage, importedBy) {
      return importMapPackage({ registry, rawPackage, importedBy });
    },
    activatePackage(packageId, packageVersion, approvedBy, reason) {
      return activateMapPackage({ registry, packageId, packageVersion, approvedBy, reason });
    },
    rollbackActiveMap(mapId, rolledBackBy, reason) {
      return rollbackMapPackage({ registry, mapId, rolledBackBy, reason });
    },
    listDeveloperCatalog() {
      return registry.versions.listAll().map((mapPackage) => toDeveloperMapPackageItem(registry, mapPackage));
    },
  };

  return registry;
};

export function MapPluginRegistry(): MapPluginRegistry {
  return createMapPluginRegistry();
}

let defaultRegistry: MapPluginRegistry | null = null;

const seedBuiltinPackages = (registry: MapPluginRegistry): void => {
  for (const builtinPackage of loadBuiltinMapPackages()) {
    registry.importPackage(builtinPackage, "builtin-loader");
    if (shouldActivateBuiltinPackage(builtinPackage)) {
      registry.activatePackage(
        builtinPackage.manifest.packageId,
        builtinPackage.manifest.packageVersion,
        "builtin-loader",
        "builtin activation",
      );
    }
  }
};

export function getDefaultMapPluginRegistry(): MapPluginRegistry {
  if (defaultRegistry) {
    return defaultRegistry;
  }

  const registry = createMapPluginRegistry();
  seedBuiltinPackages(registry);

  defaultRegistry = registry;
  return defaultRegistry;
}
