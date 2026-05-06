import { readBuiltin } from "../builtin-loader/builtin-map-package-loader.js";
import type { MapPackage } from "../shared/map-package-types.js";

export { BuiltinMapPackageLoadError } from "../builtin-loader/builtin-map-package-load-error.js";

export function loadBuiltinMapPackages(): MapPackage[] {
  return [
    readBuiltin("facebook-seeding-video-discovery.meta.map-package.json"),
    readBuiltin("iphone-mirroring-facebook-seeding-video-discovery.meta.map-package.json"),
    readBuiltin("iphone-mirroring-tiktok-seeding-video-discovery.meta.map-package.json"),
    readBuiltin("macos-local-program-open-smoke.meta.map-package.json"),
    readBuiltin("tiktok-seeding-video-discovery.meta.map-package.json"),
  ];
}
