import { readFileSync } from "node:fs";

import { MapPackageSchema } from "../schema/map-plugin-package.schema.js";
import type { MapPackage } from "../shared/map-package-types.js";

function readBuiltin(fileName: string): MapPackage {
  const content = readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8");
  return MapPackageSchema.parse(JSON.parse(content));
}

export function loadBuiltinMapPackages(): MapPackage[] {
  return [
    readBuiltin("tiktok-product-discovery.map-package.json"),
    readBuiltin("tiktok-comment-evidence.map-package.json"),
    readBuiltin("ai-draft-map-placeholder.map-package.json")
  ];
}
