export type MapActivationRecord = {
  activationId: string;
  activationSnapshotRef: string;
  activationSnapshotHash: string;
  mapPackageId: string;
  mapPackageVersion: string;
  mapId: string;
  mapVersion: string;
  taskTemplateId: string;
  requestedPlatformId: string | null;
  approvedBy: string;
  activatedAt: string;
  reason: string;
  humanApprovalRef: string;
  validationReportRef: string;
  capabilityCatalogVersion: string;
  promptCatalogVersion: string;
  operationalMapHash: string;
  mapPackageHash: string;
  importProofRef: string;
  quarantineProofRef: string;
  activationProofRef: string;
  authoringProofRef: string | null;
};

export type MapRollbackRecord = {
  rollbackId: string;
  activationId: string;
  mapPackageId: string;
  mapPackageVersion: string;
  mapId: string;
  rolledBackBy: string;
  rolledBackAt: string;
  reason: string;
};

function normalizeProofSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9:_-]/g, "_");
}

export function buildImportProofRef(input: {
  packageId: string;
  packageVersion: string;
  importedAt: string;
}): string {
  return [
    "map-proof:import",
    input.packageId,
    input.packageVersion,
    normalizeProofSegment(input.importedAt),
  ].join(":");
}

export function buildQuarantineProofRef(input: {
  packageId: string;
  packageVersion: string;
  importedAt: string;
}): string {
  return [
    "map-proof:quarantine",
    input.packageId,
    input.packageVersion,
    normalizeProofSegment(input.importedAt),
  ].join(":");
}

export function buildActivationProofRef(input: {
  activationId: string;
  packageId: string;
  packageVersion: string;
}): string {
  return [
    "map-proof:activation",
    input.packageId,
    input.packageVersion,
    input.activationId,
  ].join(":");
}
