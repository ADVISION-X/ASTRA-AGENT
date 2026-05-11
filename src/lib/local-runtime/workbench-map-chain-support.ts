export type WorkbenchMapChain = {
  bindingPackageId: string | null;
  bindingPackageVersion: string | null;
  bindingVersion: string | null;
  bindingActivationRef: string | null;
  bindingSnapshotRef: string | null;
};

export const getActiveMapChain = (_mapId: string | null): WorkbenchMapChain => {
  return {
    bindingPackageId: null,
    bindingPackageVersion: null,
    bindingVersion: null,
    bindingActivationRef: null,
    bindingSnapshotRef: null,
  };
};