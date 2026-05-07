import { randomUUID } from "node:crypto";

import type { MapPluginRegistry } from "../registry/map-plugin-registry.js";
import {
  buildActivationSnapshotHash,
  buildActivationSnapshotRef,
  buildMapPackageHash,
  buildOperationalMapHash,
} from "../shared/map-package-fingerprint.js";
import { buildActivationProofRef } from "../shared/map-package-proof.js";
import type { QuarantinedMapRecord } from "../registry/quarantined-map-registry.js";

type ActivationFailureReason = "map_not_found" | "map_validation_failed" | "automation_gate_not_passed";

type ActivationFailure = {
  activated: false;
  reason: ActivationFailureReason;
};

type ActivationManifestRefs = {
  automationGateRef: string;
  validationReportRef: string;
  capabilityCatalogVersion: string;
  promptCatalogVersion: string;
};

type ActivationRecordInput = {
  activationId: string;
  mapPackage: NonNullable<ReturnType<MapPluginRegistry["versions"]["get"]>>;
  quarantined: QuarantinedMapRecord;
  gateActor: string;
  reason: string;
  manifestRefs: ActivationManifestRefs;
};

function createActivationFailure(reason: ActivationFailureReason): ActivationFailure {
  return { activated: false, reason };
}

function isActivationFailure(value: ActivationFailure | object): value is ActivationFailure {
  return "activated" in value && value.activated === false;
}

function resolveAuthoringProofRef(mapPackage: NonNullable<ReturnType<MapPluginRegistry["versions"]["get"]>>): string | null {
  const candidate = (mapPackage.manifest as Record<string, unknown>).authoringProofRef;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

function resolveActivationPackage(input: {
  registry: MapPluginRegistry;
  packageId: string;
  packageVersion: string;
}): ActivationFailure | {
  mapPackage: NonNullable<ReturnType<MapPluginRegistry["versions"]["get"]>>;
  quarantined: QuarantinedMapRecord;
} {
  const quarantined = input.registry.quarantined.get(input.packageId, input.packageVersion);
  const mapPackage = input.registry.versions.get(input.packageId, input.packageVersion);
  if (!quarantined || !mapPackage) {
    return createActivationFailure("map_not_found");
  }
  if (quarantined.validationIssues.length > 0) {
    return createActivationFailure("map_validation_failed");
  }
  return { mapPackage, quarantined };
}

function resolveActivationManifestRefs(mapPackage: NonNullable<ReturnType<MapPluginRegistry["versions"]["get"]>>): ActivationFailure | ActivationManifestRefs {
  if (mapPackage.manifest.activationGateStatus !== "gate_passed" || mapPackage.manifest.automationGateRef === null) {
    return createActivationFailure("automation_gate_not_passed");
  }
  if (mapPackage.manifest.validationReportRef === null) {
    return createActivationFailure("map_validation_failed");
  }
  if (mapPackage.manifest.capabilityCatalogVersion === null || mapPackage.manifest.promptCatalogVersion === null) {
    return createActivationFailure("map_validation_failed");
  }
  return {
    automationGateRef: mapPackage.manifest.automationGateRef,
    validationReportRef: mapPackage.manifest.validationReportRef,
    capabilityCatalogVersion: mapPackage.manifest.capabilityCatalogVersion,
    promptCatalogVersion: mapPackage.manifest.promptCatalogVersion,
  };
}

function buildActivationSnapshotFields(input: ActivationRecordInput) {
  const activationSnapshotRef = buildActivationSnapshotRef({
    activationId: input.activationId,
    packageVersion: input.mapPackage.manifest.packageVersion,
    mapVersion: input.mapPackage.operationalMap.mapVersion,
  });
  const mapPackageHash = buildMapPackageHash(input.mapPackage);
  const operationalMapHash = buildOperationalMapHash(input.mapPackage.operationalMap);
  const activationProofRef = buildActivationProofRef({
    activationId: input.activationId,
    packageId: input.mapPackage.manifest.packageId,
    packageVersion: input.mapPackage.manifest.packageVersion,
  });
  const activationSnapshotHash = buildActivationSnapshotHash({
    activationSnapshotRef,
    mapPackageHash,
    operationalMapHash,
    capabilityCatalogVersion: input.manifestRefs.capabilityCatalogVersion,
    promptCatalogVersion: input.manifestRefs.promptCatalogVersion,
  });

  return {
    activationSnapshotRef,
    activationSnapshotHash,
    mapPackageHash,
    operationalMapHash,
  };
}

function buildActivationProofFields(input: ActivationRecordInput) {
  return {
    importProofRef: input.quarantined.importProofRef,
    quarantineProofRef: input.quarantined.quarantineProofRef,
    activationProofRef: buildActivationProofRef({
      activationId: input.activationId,
      packageId: input.mapPackage.manifest.packageId,
      packageVersion: input.mapPackage.manifest.packageVersion,
    }),
    authoringProofRef: resolveAuthoringProofRef(input.mapPackage),
  };
}

function buildActivationRecord(input: ActivationRecordInput) {
  const snapshotFields = buildActivationSnapshotFields(input);
  return {
    activationId: input.activationId,
    activationSnapshotRef: snapshotFields.activationSnapshotRef,
    activationSnapshotHash: snapshotFields.activationSnapshotHash,
    mapPackageId: input.mapPackage.manifest.packageId,
    mapPackageVersion: input.mapPackage.manifest.packageVersion,
    mapId: input.mapPackage.manifest.mapId,
    mapVersion: input.mapPackage.operationalMap.mapVersion,
    taskTemplateId: input.mapPackage.taskTemplate.taskTemplateId,
    requestedPlatformId: input.mapPackage.taskTemplate.requestedPlatformId,
    gateActor: input.gateActor,
    activatedAt: new Date().toISOString(),
    reason: input.reason,
    automationGateRef: input.manifestRefs.automationGateRef,
    validationReportRef: input.manifestRefs.validationReportRef,
    capabilityCatalogVersion: input.manifestRefs.capabilityCatalogVersion,
    promptCatalogVersion: input.manifestRefs.promptCatalogVersion,
    operationalMapHash: snapshotFields.operationalMapHash,
    mapPackageHash: snapshotFields.mapPackageHash,
    ...buildActivationProofFields(input),
  };
}

export function activateMapPackage(input: {
  registry: MapPluginRegistry;
  packageId: string;
  packageVersion: string;
  gateActor: string;
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
    quarantined: activationPackage.quarantined,
    gateActor: input.gateActor,
    reason: input.reason,
    manifestRefs,
  });
  input.registry.activations.write(activationRecord);
  input.registry.active.activate(activationPackage.mapPackage, activationRecord);
  input.registry.quarantined.delete(input.packageId, input.packageVersion);
  return { activated: true, activationRecord, mapPackage: activationPackage.mapPackage };
}
