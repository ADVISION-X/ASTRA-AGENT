export type MapActivationRecord = {
  activationId: string;
  packageId: string;
  packageVersion: string;
  mapId: string;
  approvedBy: string;
  activatedAt: string;
  reason: string;
  humanApprovalRef: string | null;
  capabilityCatalogVersion: string | null;
  promptCatalogVersion: string | null;
};

export type MapRollbackRecord = {
  rollbackId: string;
  activationId: string;
  packageId: string;
  packageVersion: string;
  mapId: string;
  rolledBackBy: string;
  rolledBackAt: string;
  reason: string;
};
