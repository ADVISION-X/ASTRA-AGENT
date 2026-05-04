import { getDevelopmentMapPluginRegistry } from "../../map-plugins/registry/map-plugin-registry.js";

export type WorkbenchMapChain = {
  mapPackageId: string | null;
  mapPackageVersion: string | null;
  selectedMapVersion: string | null;
  activationId: string | null;
  activationSnapshotRef: string | null;
};

export const getActiveMapChain = (mapId: string | null): WorkbenchMapChain => {
  if (!mapId) {
    return {
      mapPackageId: null,
      mapPackageVersion: null,
      selectedMapVersion: null,
      activationId: null,
      activationSnapshotRef: null,
    };
  }

  const record = getDevelopmentMapPluginRegistry().active.getActiveOperationalMapRecord(mapId);
  return {
    mapPackageId: record?.packageId ?? null,
    mapPackageVersion: record?.packageVersion ?? null,
    selectedMapVersion: record?.mapVersion ?? null,
    activationId: record?.activationId ?? null,
    activationSnapshotRef: record?.activationSnapshotRef ?? null,
  };
};