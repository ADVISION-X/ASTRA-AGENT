import { readFileSync } from "node:fs";

import { MapPackageSchema } from "../schema/map-plugin-package.schema.js";
import type { MapPackage } from "../shared/map-package-types.js";

function readBuiltin(fileName: string): MapPackage {
  const content = readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8");
  return MapPackageSchema.parse(JSON.parse(content));
}

export function loadBuiltinMapPackages(): MapPackage[] {
  return [
    readBuiltin("facebook-seeding-video-discovery.meta.map-package.json"),
    readBuiltin("tiktok-seeding-video-discovery.meta.map-package.json")
  ];
}
