import type { SourceFile } from "ts-morph";

import { hasExportModuleSpecifier } from "../_shared/ast-module-path-queries.js";
import { hasImportModuleSpecifier } from "../_shared/ast-helpers.js";

export function hasForbiddenCapabilityImport(sourceFile: SourceFile): boolean {
  return [
    "capabilities/ai/",
    "capabilities/screenshot/",
    "capabilities/visual-target/",
    "capabilities/mouse-click/",
    "capabilities/mouse-scroll/",
    "capabilities/open/",
    "capabilities/forensics-persistence/",
  ].some((marker) => hasImportModuleSpecifier(sourceFile, marker) || hasExportModuleSpecifier(sourceFile, marker));
}