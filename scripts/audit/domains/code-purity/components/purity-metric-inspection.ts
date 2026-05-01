import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import type { Finding } from "../../../core/schema.js";
import { IMPORT_EXPORT_LIMITS } from "./purity-thresholds.js";
import { classifyPurityFileCategory } from "./purity-file-categories.js";
import { inspectJsonContractPurity } from "./purity-json-inspection.js";
import { getImportModuleSpecifiers, getImportedSourcePaths } from "./purity-import-analysis.js";
import { classifyOwnerBoundary, getImportedOwnerBoundaries } from "./purity-owner-classification.js";
import { collectRoleMixingSignals, createPurityFinding, inspectBoundaryAndExportLimits, inspectClassLimits, inspectCleanupAndEscapes, inspectFunctionLimits, inspectLiteralAndPathPurity } from "./purity-metric-helpers.js";
import { appendItemToInventories } from "./purity-report-inventories.js";
import { createPurityInventoryItem } from "./purity-report-draft.js";
import type { PurityReportDraft } from "./purity-report-types.js";

export type { PurityInventoryItem, PurityReportDraft } from "./purity-report-types.js";
export { createEmptyPurityReport } from "./purity-report-draft.js";

type PrimaryRole =
  | "schema"
  | "contract"
  | "input-gate"
  | "policy-gate"
  | "executor"
  | "runner"
  | "adapter"
  | "result-builder"
  | "proof-builder"
  | "read-model"
  | "writer"
  | "validator"
  | "inspector"
  | "manifest"
  | "index"
  | "type-only";

type RoleMatcher = { role: PrimaryRole; matches: (sourceFile: SourceFile, relativePath: string) => boolean };

const isJsonLikePath = (relativePath: string): boolean => relativePath.endsWith(".json") || relativePath.endsWith(".jsonc");
const isGeneratedArtifactPath = (relativePath: string): boolean => relativePath.startsWith("scripts/audit/generated/") || relativePath.endsWith(".generated.json") || relativePath.endsWith(".generated.jsonc");
const hasRuntimeBody = (sourceFile: SourceFile): boolean => sourceFile.getFunctions().length > 0 || sourceFile.getClasses().length > 0 || sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).length > 0;
const hasSchemaBody = (sourceFile: SourceFile): boolean => sourceFile.getInterfaces().length > 0 || sourceFile.getTypeAliases().length > 0;
const hasFinalSuccessReturn = (sourceFile: SourceFile): boolean => sourceFile.getDescendantsOfKind(SyntaxKind.ReturnStatement).some((statement) => {
  const expression = statement.getExpression();
  if (!expression || !Node.isObjectLiteralExpression(expression)) {
    return false;
  }
  return expression.getProperties().some((property) => Node.isPropertyAssignment(property) && ["status", "success", "ok", "passed", "classification"].includes(property.getName().replace(/^[\"']|[\"']$/g, "").toLowerCase()));
});
const hasBranching = (sourceFile: SourceFile): boolean => sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement).length > 0 || sourceFile.getDescendantsOfKind(SyntaxKind.SwitchStatement).length > 0;

const PRIMARY_ROLE_MATCHERS: RoleMatcher[] = [
  { role: "type-only", matches: (_sourceFile, relativePath) => relativePath.startsWith("src/types/") || relativePath.endsWith("-types.ts") },
  { role: "read-model", matches: (_sourceFile, relativePath) => isGeneratedArtifactPath(relativePath) },
  { role: "contract", matches: (_sourceFile, relativePath) => isJsonLikePath(relativePath) && (relativePath.includes("/prompt-contracts/") || relativePath.startsWith("src/map-plugins/")) },
  { role: "manifest", matches: (_sourceFile, relativePath) => relativePath.toLowerCase().endsWith("manifest.json") },
  { role: "inspector", matches: (_sourceFile, relativePath) => relativePath.toLowerCase().endsWith("inspector.ts") },
  { role: "runner", matches: (_sourceFile, relativePath) => relativePath.toLowerCase().endsWith("runner.ts") || relativePath.toLowerCase().endsWith("run-inspector.ts") },
  { role: "validator", matches: (_sourceFile, relativePath) => relativePath.toLowerCase().includes("validator") },
  { role: "writer", matches: (_sourceFile, relativePath) => relativePath.toLowerCase().includes("writer") || relativePath.toLowerCase().includes("evidence-store") || relativePath.toLowerCase().includes("storage") },
  { role: "adapter", matches: (_sourceFile, relativePath) => relativePath.toLowerCase().includes("adapter") || relativePath.toLowerCase().includes("gateway") },
  { role: "result-builder", matches: (_sourceFile, relativePath) => relativePath.toLowerCase().includes("result") || relativePath.toLowerCase().includes("summary") },
  { role: "proof-builder", matches: (_sourceFile, relativePath) => relativePath.toLowerCase().includes("proof") },
  { role: "index", matches: (_sourceFile, relativePath) => relativePath.toLowerCase().endsWith("index.ts") },
  { role: "schema", matches: (sourceFile) => hasSchemaBody(sourceFile) && !hasRuntimeBody(sourceFile) },
  { role: "executor", matches: (sourceFile) => hasRuntimeBody(sourceFile) },
];

const classifyPrimaryRole = (sourceFile: SourceFile, relativePath: string): PrimaryRole =>
  PRIMARY_ROLE_MATCHERS.find((matcher) => matcher.matches(sourceFile, relativePath))?.role ?? "read-model";

const collectSchemaSignals = (sourceFile: SourceFile, primaryRole: PrimaryRole): string[] =>
  ["schema", "contract", "manifest", "type-only"].includes(primaryRole) && hasRuntimeBody(sourceFile) ? [`${primaryRole}-runtime-mixing`] : [];

const collectExecutorSignals = (sourceFile: SourceFile, primaryRole: PrimaryRole): string[] =>
  primaryRole === "executor" && hasSchemaBody(sourceFile) ? ["executor-schema-mixing"] : [];

const collectAdapterSignals = (sourceFile: SourceFile, primaryRole: PrimaryRole): string[] =>
  primaryRole === "adapter" && hasFinalSuccessReturn(sourceFile) ? ["adapter-final-success-mixing"] : [];

const collectWriterSignals = (sourceFile: SourceFile, primaryRole: PrimaryRole): string[] =>
  primaryRole === "writer" && hasBranching(sourceFile) ? ["writer-decision-mixing"] : [];


// Removed local primary role and role-shape signal block

const collectPurityMetricContext = (sourceFile: SourceFile, relativePath: string) => {
  const category = classifyPurityFileCategory(relativePath);
  const lineCount = sourceFile.getEndLineNumber();
  const primaryRole = classifyPrimaryRole(sourceFile, relativePath);
  const importedOwners = getImportedOwnerBoundaries(sourceFile, relativePath);
  const importDeclarations = sourceFile.getImportDeclarations().length;
  const importSources = new Set(getImportModuleSpecifiers(sourceFile)).size;
  const crossOwnerImports = getImportedSourcePaths(sourceFile).filter((importedPath) => classifyOwnerBoundary(importedPath) !== "unknown" && classifyOwnerBoundary(importedPath) !== classifyOwnerBoundary(relativePath)).length;
  const exportCount = sourceFile.getExportDeclarations().length + sourceFile.getExportAssignments().length + sourceFile.getStatements().filter((statement) => "hasExportKeyword" in statement && typeof statement.hasExportKeyword === "function" && statement.hasExportKeyword()).length;
  const roleMixingSignals = collectRoleMixingSignals(sourceFile, relativePath, importedOwners);

  return {
    category,
    lineCount,
    primaryRole,
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
  const { category, lineCount, primaryRole, importedOwners, importDeclarations, importSources, crossOwnerImports, exportCount, roleMixingSignals } = collectPurityMetricContext(sourceFile, relativePath);

  inspectFileLineLimits({ relativePath, touchedPaths, lineCount, label: category.label, hardLimit: category.hardLimit, findings });
  inspectJsonContractPurity(sourceFile, relativePath, findings);

  if (category.kind !== "generatedArtifact" && category.kind !== "jsonContract") {
    inspectCleanupAndEscapes(sourceFile, relativePath, findings);
    inspectLiteralAndPathPurity(sourceFile, relativePath, findings);
  }

  const functionOverLimit = inspectFunctionLimits(sourceFile, relativePath, findings);
  const { classOverLimit, maxClassMembers } = inspectClassLimits(sourceFile, relativePath, findings);
  inspectBoundaryAndExportLimits({ sourceFile, relativePath, findings, importedOwners, crossOwnerImports, importDeclarations, importSources, exportCount, roleMixingSignals });

  const item = createPurityInventoryItem({
    relativePath,
    lineCount,
    fileType: category.label,
    overLimitBy: Math.max(0, lineCount - category.hardLimit),
    primaryRole,
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