import { type SourceFile } from "ts-morph";

import type { Finding } from "../../../core/schema.js";
import { IMPORT_EXPORT_LIMITS } from "./purity-constants.js";
import { classifyOwnerBoundary, classifyPurityFileCategory, getImportModuleSpecifiers, getImportedOwnerBoundaries, getImportedSourcePaths, hasProductionFakeImport, isGenericBucketSourceFile, isProductionFakePath } from "./purity-file-classification.js";
import { collectRoleMixingSignals, createPurityFinding, inspectBoundaryAndExportLimits, inspectClassLimits, inspectCleanupAndEscapes, inspectFunctionLimits, inspectLiteralAndPathPurity } from "./purity-metric-helpers.js";
import { appendItemToInventories } from "./purity-report-inventories.js";
import { createPurityInventoryItem, type PurityReportDraft } from "./purity-report-draft.js";

export type { PurityInventoryItem, PurityReportDraft } from "./purity-report-draft.js";
export { createEmptyPurityReport } from "./purity-report-draft.js";

export const inspectPurityMetrics = (sourceFile: SourceFile, relativePath: string, touchedPaths: Set<string>, report: PurityReportDraft): Finding[] => {
  const findings: Finding[] = [];
  const category = classifyPurityFileCategory(relativePath);
  const lineCount = sourceFile.getEndLineNumber();
  const importedOwners = getImportedOwnerBoundaries(sourceFile, relativePath);
  const importDeclarations = sourceFile.getImportDeclarations().length;
  const importSources = new Set(getImportModuleSpecifiers(sourceFile)).size;
  const crossOwnerImports = getImportedSourcePaths(sourceFile).filter((importedPath) => classifyOwnerBoundary(importedPath) !== "unknown" && classifyOwnerBoundary(importedPath) !== classifyOwnerBoundary(relativePath)).length;
  const exportCount = sourceFile.getExportDeclarations().length + sourceFile.getExportAssignments().length + sourceFile.getStatements().filter((statement) => "hasExportKeyword" in statement && typeof statement.hasExportKeyword === "function" && statement.hasExportKeyword()).length;
  const roleMixingSignals = collectRoleMixingSignals(sourceFile, relativePath, importedOwners);

  inspectCleanupAndEscapes(sourceFile, relativePath, findings);

  if (lineCount > category.hardLimit) {
    findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-001-V1", relativePath, line: 1, message: `File exceeds the ${category.label} hard limit of ${category.hardLimit} lines.`, detail: String(lineCount) }));
  }
  if (touchedPaths.has(relativePath) && lineCount > category.hardLimit) {
    findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-002-V1", relativePath, line: 1, message: "Touched file exceeds its code-purity hard limit and must be physically split before more logic is accepted." }));
  }

  const functionOverLimit = inspectFunctionLimits(sourceFile, relativePath, findings);
  const { classOverLimit, maxClassMembers } = inspectClassLimits(sourceFile, relativePath, findings);
  inspectBoundaryAndExportLimits({ sourceFile, relativePath, findings, importedOwners, crossOwnerImports, importDeclarations, importSources, exportCount, roleMixingSignals });
  inspectLiteralAndPathPurity(sourceFile, relativePath, findings);

  const item = createPurityInventoryItem({
    relativePath,
    lineCount,
    fileType: category.label,
    overLimitBy: Math.max(0, lineCount - category.hardLimit),
    functionsOverLimit: functionOverLimit,
    classMembers: maxClassMembers,
    importCount: importDeclarations,
    crossOwnerImports,
    ownerBoundaries: importedOwners.length,
    roleMixingSignals,
  });
  appendItemToInventories({
    report,
    item,
    touchedPaths,
    relativePath,
    lineCount,
    hardLimit: category.hardLimit,
    functionOverLimit,
    classOverLimit,
    importDeclarations,
    importSources,
    exportCount,
    crossOwnerImports,
    importedOwners,
    roleMixingSignals,
  });

  return findings;
};