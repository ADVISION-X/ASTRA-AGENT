import { getDevelopmentMapPluginRegistry } from "../../map-plugins/registry/map-plugin-registry.js";

export type WorkbenchMapChain = {
  bindingPackageId: string | null;
  bindingPackageVersion: string | null;
  bindingVersion: string | null;
  bindingActivationRef: string | null;
  bindingSnapshotRef: string | null;
};

export const getActiveMapChain = (mapId: string | null): WorkbenchMapChain => {
  if (!mapId) {
    return {
      bindingPackageId: null,
      bindingPackageVersion: null,
      bindingVersion: null,
      bindingActivationRef: null,
      bindingSnapshotRef: null,
    };
  }

  const record = getDevelopmentMapPluginRegistry().active.getActiveOperationalMapRecord(mapId);
  return {
    bindingPackageId: record?.packageId ?? null,
    bindingPackageVersion: record?.packageVersion ?? null,
    bindingVersion: record?.mapVersion ?? null,
    bindingActivationRef: record?.bindingActivationRef ?? null,
    bindingSnapshotRef: record?.bindingSnapshotRef ?? null,
  };
};