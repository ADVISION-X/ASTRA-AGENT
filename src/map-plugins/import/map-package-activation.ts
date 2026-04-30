import { randomUUID } from "node:crypto";

import type { MapPluginRegistry } from "../registry/map-plugin-registry.js";

export function activateMapPackage(input: {
  registry: MapPluginRegistry;
  packageId: string;
  packageVersion: string;
  approvedBy: string;
  reason: string;
}) {
  const quarantined = input.registry.quarantined.get(input.packageId, input.packageVersion);
  const mapPackage = input.registry.versions.get(input.packageId, input.packageVersion);
  if (!quarantined || !mapPackage) {
    return { activated: false, reason: "map_not_found" as const };
  }
  if (quarantined.validationIssues.length > 0) {
    return { activated: false, reason: "map_validation_failed" as const };
  }
  if (mapPackage.manifest.approvalStatus !== "approved") {
    return { activated: false, reason: "map_not_approved" as const };
  }
  if (mapPackage.manifest.aiGenerated && mapPackage.manifest.humanApprovalRef === null) {
    return { activated: false, reason: "map_not_approved" as const };
  }

  const activationRecord = {
    activationId: randomUUID(),
    packageId: mapPackage.manifest.packageId,
    packageVersion: mapPackage.manifest.packageVersion,
    mapId: mapPackage.manifest.mapId,
    approvedBy: input.approvedBy,
    activatedAt: new Date().toISOString(),
    reason: input.reason,
    humanApprovalRef: mapPackage.manifest.humanApprovalRef,
    capabilityCatalogVersion: mapPackage.manifest.capabilityCatalogVersion,
    promptCatalogVersion: mapPackage.manifest.promptCatalogVersion
  };
  input.registry.activations.write(activationRecord);
  input.registry.active.activate(mapPackage, activationRecord);
  input.registry.quarantined.delete(input.packageId, input.packageVersion);
  return { activated: true, activationRecord, mapPackage };
}
