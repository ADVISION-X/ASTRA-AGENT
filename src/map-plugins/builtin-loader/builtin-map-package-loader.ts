import { readFileSync } from "node:fs";

import type { MapPackage } from "../shared/map-package-types.js";
import { parseBuiltinPackage } from "./builtin-map-package-parser.js";

export function readBuiltin(fileName: string): MapPackage {
  const content = readFileSync(new URL(`../builtins/${fileName}`, import.meta.url), "utf8");
  return parseBuiltinPackage(fileName, JSON.parse(content));
}
