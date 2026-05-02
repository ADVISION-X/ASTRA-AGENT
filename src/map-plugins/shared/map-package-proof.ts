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
