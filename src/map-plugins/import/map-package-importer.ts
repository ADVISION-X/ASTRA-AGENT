import { validateMapPackage } from "../validation/map-package-validator.js";
import type { MapPluginRegistry } from "../registry/map-plugin-registry.js";
import {
  buildImportProofRef,
  buildQuarantineProofRef,
} from "../shared/map-package-proof.js";

export function importMapPackage(input: {
  registry: MapPluginRegistry;
  rawPackage: unknown;
  importedBy: string;
}) {
  const validation = validateMapPackage(input.rawPackage);
  if (!validation.mapPackage) {
    return {
      imported: false,
      lifecycleStatus: "quarantined" as const,
      validationIssues: validation.issues
    };
  }

  const importedAt = new Date().toISOString();
  input.registry.versions.set(validation.mapPackage);
  input.registry.quarantined.set({
    importedAt,
    importedBy: input.importedBy,
    importProofRef: buildImportProofRef({
      packageId: validation.mapPackage.manifest.packageId,
      packageVersion: validation.mapPackage.manifest.packageVersion,
      importedAt,
    }),
    quarantineProofRef: buildQuarantineProofRef({
      packageId: validation.mapPackage.manifest.packageId,
      packageVersion: validation.mapPackage.manifest.packageVersion,
      importedAt,
    }),
    mapPackage: validation.mapPackage,
    validationIssues: validation.issues
  });

  return {
    imported: true,
    lifecycleStatus: "quarantined" as const,
    validationIssues: validation.issues,
    mapPackage: validation.mapPackage
  };
}
