import { loadBuiltinMapPackages } from "../builtins/index.js";
import { approveMapPackage } from "../import/map-package-approval.js";
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

const BUILTIN_PRODUCTION_IMPORTER = "builtin-production-seed";
const BUILTIN_DEVELOPMENT_ACTOR = "builtin-development-seed";

export type MapPluginRegistryBootstrapMode = "production" | "development";

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

const formatValidationIssues = (issues: Array<{ path?: string; code: string; message: string }>): string =>
  issues
    .slice(0, 3)
    .map((issue) => `${issue.path ?? "root"}: ${issue.code}: ${issue.message}`)
    .join("; ");

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

const registryCache = new Map<MapPluginRegistryBootstrapMode, MapPluginRegistry>();

const seedBuiltinQuarantine = (registry: MapPluginRegistry): void => {
  for (const builtinPackage of loadBuiltinMapPackages()) {
    const imported = registry.importPackage(builtinPackage, BUILTIN_PRODUCTION_IMPORTER);
    if (!imported.imported) {
      throw new Error(`Builtin map package ${builtinPackage.manifest.packageId} failed quarantine import.`);
    }
  }
};

const seedBuiltinDevelopmentActivation = (registry: MapPluginRegistry): void => {
  for (const builtinPackage of loadBuiltinMapPackages()) {
    const imported = registry.importPackage(builtinPackage, BUILTIN_DEVELOPMENT_ACTOR);
    if (!imported.imported) {
      throw new Error(`Builtin map package ${builtinPackage.manifest.packageId} failed development import.`);
    }
    if (!shouldActivateBuiltinPackage(builtinPackage)) {
      continue;
    }

    const approved = approveMapPackage({
      registry,
      packageId: builtinPackage.manifest.packageId,
      packageVersion: builtinPackage.manifest.packageVersion,
      approvedBy: BUILTIN_DEVELOPMENT_ACTOR,
    });
    if (!approved.approved) {
      const detail = approved.validationIssues.length > 0
        ? ` validationIssues=${formatValidationIssues(approved.validationIssues)}`
        : "";
      throw new Error(`Builtin map package ${builtinPackage.manifest.packageId} failed development approval.${detail}`);
    }

    const activated = registry.activatePackage(
      builtinPackage.manifest.packageId,
      builtinPackage.manifest.packageVersion,
      BUILTIN_DEVELOPMENT_ACTOR,
      "development builtin activation",
    );
    if (activated.activated === false) {
      throw new Error(`Builtin map package ${builtinPackage.manifest.packageId} failed development activation.`);
    }
  }
};

const createBuiltinSeededRegistry = (bootstrapMode: MapPluginRegistryBootstrapMode): MapPluginRegistry => {
  const registry = createMapPluginRegistry();
  if (bootstrapMode === "development") {
    seedBuiltinDevelopmentActivation(registry);
  } else {
    seedBuiltinQuarantine(registry);
  }

  return registry;
};

export function getDefaultMapPluginRegistry(): MapPluginRegistry {
  const cached = registryCache.get("production");
  if (cached) {
    return cached;
  }

  const registry = createBuiltinSeededRegistry("production");
  registryCache.set("production", registry);
  return registry;
}

export function getDevelopmentMapPluginRegistry(): MapPluginRegistry {
  const cached = registryCache.get("development");
  if (cached) {
    return cached;
  }

  const registry = createBuiltinSeededRegistry("development");
  registryCache.set("development", registry);
  return registry;
}
