import type { OwnerManifest } from "../../../core/schema.js";

import { runAstSymbolEnforcement } from "./ast-symbol-enforcement.js";

export const runInspectorQualityGate = (manifests: OwnerManifest[]) =>
  runAstSymbolEnforcement(manifests);