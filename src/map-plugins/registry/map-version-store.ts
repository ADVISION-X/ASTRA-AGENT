import type { MapPackage } from "../shared/map-package-types.js";

export class MapPackageVersionStore {
  private readonly packagesById = new Map<string, Map<string, MapPackage>>();

  set(mapPackage: MapPackage): void {
    const versions = this.packagesById.get(mapPackage.manifest.packageId) ?? new Map<string, MapPackage>();
    versions.set(mapPackage.manifest.packageVersion, mapPackage);
    this.packagesById.set(mapPackage.manifest.packageId, versions);
  }

  get(packageId: string, packageVersion: string): MapPackage | null {
    return this.packagesById.get(packageId)?.get(packageVersion) ?? null;
  }

  listAll(): MapPackage[] {
    return [...this.packagesById.values()].flatMap((versions) => [...versions.values()]);
  }
}
