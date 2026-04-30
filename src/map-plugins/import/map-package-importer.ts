import { validateMapPackage } from "../validation/map-package-validator.js";
import type { MapPluginRegistry } from "../registry/map-plugin-registry.js";

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

  input.registry.versions.set(validation.mapPackage);
  input.registry.quarantined.set({
    importedAt: new Date().toISOString(),
    importedBy: input.importedBy,
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
