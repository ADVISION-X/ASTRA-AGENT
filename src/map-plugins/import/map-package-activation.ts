import { randomUUID } from "node:crypto";

import type { MapPluginRegistry } from "../registry/map-plugin-registry.js";
import {
  buildActivationSnapshotHash,
  buildActivationSnapshotRef,
  buildMapPackageHash,
  buildOperationalMapHash,
} from "../shared/map-package-fingerprint.js";

type ActivationFailureReason = "map_not_found" | "map_validation_failed" | "map_not_approved";

type ActivationFailure = {
  activated: false;
  reason: ActivationFailureReason;
};

type ActivationManifestRefs = {
  humanApprovalRef: string;
  validationReportRef: string;
  capabilityCatalogVersion: string;
  promptCatalogVersion: string;
};

function createActivationFailure(reason: ActivationFailureReason): ActivationFailure {
  return { activated: false, reason };
}

function isActivationFailure(value: ActivationFailure | object): value is ActivationFailure {
  return "activated" in value && value.activated === false;
}

function resolveActivationPackage(input: {
  registry: MapPluginRegistry;
  packageId: string;
  packageVersion: string;
}): ActivationFailure | { mapPackage: NonNullable<ReturnType<MapPluginRegistry["versions"]["get"]>> } {
  const quarantined = input.registry.quarantined.get(input.packageId, input.packageVersion);
  const mapPackage = input.registry.versions.get(input.packageId, input.packageVersion);
  if (!quarantined || !mapPackage) {
    return createActivationFailure("map_not_found");
  }
  if (quarantined.validationIssues.length > 0) {
    return createActivationFailure("map_validation_failed");
  }
  return { mapPackage };
}

function resolveActivationManifestRefs(mapPackage: NonNullable<ReturnType<MapPluginRegistry["versions"]["get"]>>): ActivationFailure | ActivationManifestRefs {
  if (mapPackage.manifest.approvalStatus !== "approved" || mapPackage.manifest.humanApprovalRef === null) {
    return createActivationFailure("map_not_approved");
  }
  if (mapPackage.manifest.validationReportRef === null) {
    return createActivationFailure("map_validation_failed");
  }
  if (mapPackage.manifest.capabilityCatalogVersion === null || mapPackage.manifest.promptCatalogVersion === null) {
    return createActivationFailure("map_validation_failed");
  }
  return {
    humanApprovalRef: mapPackage.manifest.humanApprovalRef,
    validationReportRef: mapPackage.manifest.validationReportRef,
    capabilityCatalogVersion: mapPackage.manifest.capabilityCatalogVersion,
    promptCatalogVersion: mapPackage.manifest.promptCatalogVersion,
  };
}

function buildActivationRecord(input: {
  activationId: string;
  mapPackage: NonNullable<ReturnType<MapPluginRegistry["versions"]["get"]>>;
  approvedBy: string;
  reason: string;
  manifestRefs: ActivationManifestRefs;
}) {
  const activationSnapshotRef = buildActivationSnapshotRef({
    activationId: input.activationId,
    packageVersion: input.mapPackage.manifest.packageVersion,
    mapVersion: input.mapPackage.operationalMap.mapVersion,
  });
  const mapPackageHash = buildMapPackageHash(input.mapPackage);
  const operationalMapHash = buildOperationalMapHash(input.mapPackage.operationalMap);
  const activationSnapshotHash = buildActivationSnapshotHash({
    activationSnapshotRef,
    mapPackageHash,
    operationalMapHash,
    capabilityCatalogVersion: input.manifestRefs.capabilityCatalogVersion,
    promptCatalogVersion: input.manifestRefs.promptCatalogVersion,
  });

  return {
    activationId: input.activationId,
    activationSnapshotRef,
    activationSnapshotHash,
    mapPackageId: input.mapPackage.manifest.packageId,
    mapPackageVersion: input.mapPackage.manifest.packageVersion,
    mapId: input.mapPackage.manifest.mapId,
    mapVersion: input.mapPackage.operationalMap.mapVersion,
    taskTemplateId: input.mapPackage.taskTemplate.taskTemplateId,
    requestedPlatformId: input.mapPackage.taskTemplate.requestedPlatformId,
    approvedBy: input.approvedBy,
    activatedAt: new Date().toISOString(),
    reason: input.reason,
    humanApprovalRef: input.manifestRefs.humanApprovalRef,
    validationReportRef: input.manifestRefs.validationReportRef,
    capabilityCatalogVersion: input.manifestRefs.capabilityCatalogVersion,
    promptCatalogVersion: input.manifestRefs.promptCatalogVersion,
    operationalMapHash,
    mapPackageHash,
  };
}

export function activateMapPackage(input: {
  registry: MapPluginRegistry;
  packageId: string;
  packageVersion: string;
  approvedBy: string;
  reason: string;
}) {
  const activationPackage = resolveActivationPackage(input);
  if (isActivationFailure(activationPackage)) {
    return activationPackage;
  }

  const manifestRefs = resolveActivationManifestRefs(activationPackage.mapPackage);
  if (isActivationFailure(manifestRefs)) {
    return manifestRefs;
  }

  const activationRecord = buildActivationRecord({
    activationId: randomUUID(),
    mapPackage: activationPackage.mapPackage,
    approvedBy: input.approvedBy,
    reason: input.reason,
    manifestRefs,
  });
  input.registry.activations.write(activationRecord);
  input.registry.active.activate(activationPackage.mapPackage, activationRecord);
  input.registry.quarantined.delete(input.packageId, input.packageVersion);
  return { activated: true, activationRecord, mapPackage: activationPackage.mapPackage };
}
