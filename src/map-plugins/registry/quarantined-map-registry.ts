import type { MapPackageValidationIssue } from "../shared/map-package-failure.js";
import type { MapPackage } from "../shared/map-package-types.js";

export type QuarantinedMapRecord = {
  importedAt: string;
  importedBy: string;
  mapPackage: MapPackage;
  validationIssues: MapPackageValidationIssue[];
};

export class QuarantinedMapRegistry {
  private readonly records = new Map<string, QuarantinedMapRecord>();

  private buildKey(packageId: string, packageVersion: string): string {
    return `${packageId}@${packageVersion}`;
  }

  set(record: QuarantinedMapRecord): void {
    this.records.set(this.buildKey(record.mapPackage.manifest.packageId, record.mapPackage.manifest.packageVersion), record);
  }

  get(packageId: string, packageVersion: string): QuarantinedMapRecord | null {
    return this.records.get(this.buildKey(packageId, packageVersion)) ?? null;
  }

  delete(packageId: string, packageVersion: string): void {
    this.records.delete(this.buildKey(packageId, packageVersion));
  }

  list(): QuarantinedMapRecord[] {
    return [...this.records.values()];
  }
}
