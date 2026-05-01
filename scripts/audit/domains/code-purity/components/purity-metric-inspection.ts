import { type SourceFile } from "ts-morph";

import type { Finding } from "../../../core/schema.js";
import { IMPORT_EXPORT_LIMITS } from "./purity-thresholds.js";
import { classifyPurityFileCategory } from "./purity-file-categories.js";
import { getImportModuleSpecifiers, getImportedSourcePaths } from "./purity-import-analysis.js";
import { classifyOwnerBoundary, getImportedOwnerBoundaries } from "./purity-owner-classification.js";
import { collectRoleMixingSignals, createPurityFinding, inspectBoundaryAndExportLimits, inspectClassLimits, inspectCleanupAndEscapes, inspectFunctionLimits, inspectLiteralAndPathPurity } from "./purity-metric-helpers.js";
import { appendItemToInventories } from "./purity-report-inventories.js";
import { createPurityInventoryItem } from "./purity-report-draft.js";
import type { PurityReportDraft } from "./purity-report-types.js";

export type { PurityInventoryItem, PurityReportDraft } from "./purity-report-types.js";
export { createEmptyPurityReport } from "./purity-report-draft.js";

const collectPurityMetricContext = (sourceFile: SourceFile, relativePath: string) => {
  const category = classifyPurityFileCategory(relativePath);
  const lineCount = sourceFile.getEndLineNumber();
  const importedOwners = getImportedOwnerBoundaries(sourceFile, relativePath);
  const importDeclarations = sourceFile.getImportDeclarations().length;
  const importSources = new Set(getImportModuleSpecifiers(sourceFile)).size;
  const crossOwnerImports = getImportedSourcePaths(sourceFile).filter((importedPath) => classifyOwnerBoundary(importedPath) !== "unknown" && classifyOwnerBoundary(importedPath) !== classifyOwnerBoundary(relativePath)).length;
  const exportCount = sourceFile.getExportDeclarations().length + sourceFile.getExportAssignments().length + sourceFile.getStatements().filter((statement) => "hasExportKeyword" in statement && typeof statement.hasExportKeyword === "function" && statement.hasExportKeyword()).length;
  const roleMixingSignals = collectRoleMixingSignals(sourceFile, relativePath, importedOwners);

  return {
    category,
    lineCount,
    importedOwners,
    importDeclarations,
    importSources,
    crossOwnerImports,
    exportCount,
    roleMixingSignals,
  };
};

const inspectFileLineLimits = (input: {
  relativePath: string;
  touchedPaths: Set<string>;
  lineCount: number;
  label: string;
  hardLimit: number;
  findings: Finding[];
}): void => {
  if (input.lineCount > input.hardLimit) {
    input.findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-001-V1", relativePath: input.relativePath, line: 1, message: `File exceeds the ${input.label} hard limit of ${input.hardLimit} lines.`, detail: String(input.lineCount) }));
  }
  if (input.touchedPaths.has(input.relativePath) && input.lineCount > input.hardLimit) {
    input.findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-002-V1", relativePath: input.relativePath, line: 1, message: "Touched file exceeds its code-purity hard limit and must be physically split before more logic is accepted." }));
  }
};

export const inspectPurityMetrics = (sourceFile: SourceFile, relativePath: string, touchedPaths: Set<string>, report: PurityReportDraft): Finding[] => {
  const findings: Finding[] = [];
  const { category, lineCount, importedOwners, importDeclarations, importSources, crossOwnerImports, exportCount, roleMixingSignals } = collectPurityMetricContext(sourceFile, relativePath);

  inspectCleanupAndEscapes(sourceFile, relativePath, findings);
  inspectFileLineLimits({ relativePath, touchedPaths, lineCount, label: category.label, hardLimit: category.hardLimit, findings });

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