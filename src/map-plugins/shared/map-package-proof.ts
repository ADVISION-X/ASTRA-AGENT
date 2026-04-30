export type MapActivationRecord = {
  activationId: string;
  packageId: string;
  packageVersion: string;
  mapId: string;
  approvedBy: string;
  activatedAt: string;
  reason: string;
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
