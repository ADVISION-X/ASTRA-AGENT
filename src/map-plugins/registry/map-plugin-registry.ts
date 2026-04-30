import { loadBuiltinMapPackages } from "../builtins/index.js";
import { activateMapPackage } from "../import/map-package-activation.js";
import { importMapPackage } from "../import/map-package-importer.js";
import { rollbackMapPackage } from "../import/map-package-rollback.js";
import { ActiveMapRegistry } from "./active-map-registry.js";
import { MapActivationRecordStore } from "./map-activation-record.js";
import { MapRollbackRecordStore } from "./map-rollback-record.js";
import { MapPackageVersionStore } from "./map-version-store.js";
import { QuarantinedMapRegistry } from "./quarantined-map-registry.js";
import type { DeveloperMapPackageItem } from "../shared/map-package-types.js";

export class MapPluginRegistry {
  readonly versions = new MapPackageVersionStore();
  readonly quarantined = new QuarantinedMapRegistry();
  readonly active = new ActiveMapRegistry();
  readonly activations = new MapActivationRecordStore();
  readonly rollbacks = new MapRollbackRecordStore();

  importPackage(rawPackage: unknown, importedBy: string): ReturnType<typeof importMapPackage> {
    return importMapPackage({ registry: this, rawPackage, importedBy });
  }

  activatePackage(packageId: string, packageVersion: string, approvedBy: string, reason: string) {
    return activateMapPackage({ registry: this, packageId, packageVersion, approvedBy, reason });
  }

  rollbackActiveMap(mapId: string, rolledBackBy: string, reason: string) {
    return rollbackMapPackage({ registry: this, mapId, rolledBackBy, reason });
  }

  listDeveloperCatalog(): DeveloperMapPackageItem[] {
    return this.versions.listAll().map((mapPackage) => {
      const activation = this.active.getRegistration(mapPackage.manifest.mapId)?.activationRecord ?? null;
      const quarantined = this.quarantined.get(mapPackage.manifest.packageId, mapPackage.manifest.packageVersion);
      const lifecycleStatus = activation
        ? "active"
        : mapPackage.manifest.approvalStatus === "draft"
          ? "draft"
          : quarantined
            ? "quarantined"
            : "disabled";

      return {
        packageId: mapPackage.manifest.packageId,
        packageVersion: mapPackage.manifest.packageVersion,
        mapId: mapPackage.manifest.mapId,
        title: mapPackage.taskTemplate.displayName,
        lifecycleStatus,
        approvalStatus: mapPackage.manifest.approvalStatus,
        summary: mapPackage.taskTemplate.description,
        chain: mapPackage.operationalMap.allowedAbilityGroups,
        validationIssues: quarantined?.validationIssues ?? [],
        activationId: activation?.activationId ?? null,
        draftOnly: mapPackage.manifest.aiGenerated || mapPackage.taskTemplate.availabilityPolicy === "draft"
      };
    });
  }
}

let defaultRegistry: MapPluginRegistry | null = null;

export function getDefaultMapPluginRegistry(): MapPluginRegistry {
  if (defaultRegistry) {
    return defaultRegistry;
  }

  const registry = new MapPluginRegistry();
  for (const builtinPackage of loadBuiltinMapPackages()) {
    registry.importPackage(builtinPackage, "builtin-loader");
    if (builtinPackage.manifest.approvalStatus === "approved" && builtinPackage.taskTemplate.availabilityPolicy === "active") {
      registry.activatePackage(
        builtinPackage.manifest.packageId,
        builtinPackage.manifest.packageVersion,
        "builtin-loader",
        "builtin activation"
      );
    }
  }

  defaultRegistry = registry;
  return defaultRegistry;
}
