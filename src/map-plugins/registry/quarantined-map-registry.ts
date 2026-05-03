import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";

export type QuarantinedMapRecord = {
  importedAt: string;
  importedBy: string;
  importProofRef: string;
  quarantineProofRef: string;
  mapPackage: MapPackage;
  validationIssues: MapPackageValidationIssue[];
};

const buildKey = (packageId: string, packageVersion: string): string => `${packageId}@${packageVersion}`;

export type QuarantinedMapRegistry = {
  set(record: QuarantinedMapRecord): void;
  get(packageId: string, packageVersion: string): QuarantinedMapRecord | null;
  delete(packageId: string, packageVersion: string): void;
  list(): QuarantinedMapRecord[];
};

export const createQuarantinedMapRegistry = (): QuarantinedMapRegistry => {
  const records = new Map<string, QuarantinedMapRecord>();

  return {
    set(record) {
      records.set(buildKey(record.mapPackage.manifest.packageId, record.mapPackage.manifest.packageVersion), record);
    },
    get(packageId, packageVersion) {
      return records.get(buildKey(packageId, packageVersion)) ?? null;
    },
    delete(packageId, packageVersion) {
      records.delete(buildKey(packageId, packageVersion));
    },
    list() {
      return [...records.values()];
    },
  };
};
