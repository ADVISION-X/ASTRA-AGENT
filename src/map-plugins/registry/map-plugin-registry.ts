import { loadBuiltinMapPackages } from "../builtins/index.js";
import { passMapPackageAutomationGate } from "../import/map-package-automation-gate.js";
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
  if (mapPackage.manifest.activationGateStatus === "draft") {
    return "draft";
  }
  return isQuarantined ? "quarantined" : "disabled";
};

const toDeveloperMapPackageItem = (registry: MapPluginRegistry, mapPackage: MapPackage): DeveloperMapPackageItem => {
  const activation = registry.active.getRegistration(mapPackage.manifest.mapId)?.activationRecord ?? null;
  const quarantined = registry.quarantined.get(mapPackage.manifest.packageId, mapPackage.manifest.packageVersion);
  const chain = Array.from(
    new Set(mapPackage.operationalMap.steps.flatMap((step) => step.targetAbilityGroupId ? [step.targetAbilityGroupId] : [])),
  );
  return {
    packageId: mapPackage.manifest.packageId,
    packageVersion: mapPackage.manifest.packageVersion,
    mapId: mapPackage.manifest.mapId,
    title: mapPackage.taskTemplate.displayName,
    lifecycleStatus: getLifecycleStatus(mapPackage, activation?.activationId ?? null, Boolean(quarantined)),
    activationGateStatus: mapPackage.manifest.activationGateStatus,
    summary: mapPackage.taskTemplate.description,
    chain,
    validationIssues: quarantined?.validationIssues ?? [],
    activationId: activation?.activationId ?? null,
    draftOnly: mapPackage.manifest.aiGenerated || mapPackage.taskTemplate.availabilityPolicy === "draft",
  };
};

const shouldActivateBuiltinPackage = (builtinPackage: MapPackage): boolean =>
  builtinPackage.manifest.activationGateStatus === "gate_passed" && builtinPackage.taskTemplate.availabilityPolicy === "active";

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
  activatePackage(packageId: string, packageVersion: string, gateActor: string, reason: string): ReturnType<typeof activateMapPackage>;
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
    activatePackage(packageId, packageVersion, gateActor, reason) {
      return activateMapPackage({ registry, packageId, packageVersion, gateActor, reason });
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

    const gateResult = passMapPackageAutomationGate({
      registry,
      packageId: builtinPackage.manifest.packageId,
      packageVersion: builtinPackage.manifest.packageVersion,
      gateActor: BUILTIN_DEVELOPMENT_ACTOR,
    });
    if (!gateResult.gatePassed) {
      const detail = gateResult.validationIssues.length > 0
        ? ` validationIssues=${formatValidationIssues(gateResult.validationIssues)}`
        : "";
      throw new Error(`Builtin map package ${builtinPackage.manifest.packageId} failed development automation gate.${detail}`);
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
