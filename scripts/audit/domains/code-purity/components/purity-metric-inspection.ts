import { Node, SyntaxKind, type AsExpression, type IfStatement, type SourceFile } from "ts-morph";

import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import { getNodeLine } from "../../../core/ts-morph.js";
import { collectCommentTokens, hasTodoHygiene, isCommentedOutCode, isTodoComment } from "./purity-comment-analysis.js";
import { CLASS_LIMITS, DISASTER_LINE_THRESHOLD, FUNCTION_LIMITS, IMPORT_EXPORT_LIMITS } from "./purity-constants.js";
import { classifyOwnerBoundary, classifyPurityFileCategory, getImportModuleSpecifiers, getImportedOwnerBoundaries, getImportedSourcePaths, hasProductionFakeImport, isGenericBucketSourceFile, isProductionFakePath } from "./purity-file-classification.js";
import { getBooleanLikeParameterCount, getFunctionMetrics, getFunctionName, getFunctionNodes, getLogicalLineCount, isSilentCatchClause } from "./purity-function-analysis.js";

export interface PurityInventoryItem {
  file: string;
  lines: number;
  fileType: string;
  overLimitBy: number;
  functionsOverLimit: string[];
  classMembers: number;
  importCount: number;
  crossOwnerImports: number;
  ownerBoundaries: number;
  roleMixingSignals: string[];
  severity: "BLOCKING" | "DISASTER" | "REMEDIATION";
  recommendedSplit: string;
}

export interface PurityReportDraft {
  godFileInventory: PurityInventoryItem[];
  disasterFileInventory: PurityInventoryItem[];
  ownerMixingInventory: PurityInventoryItem[];
  oversizedTouchedFileInventory: PurityInventoryItem[];
  functionOverLimitInventory: PurityInventoryItem[];
  classObjectOverLimitInventory: PurityInventoryItem[];
  importExportOverLimitInventory: PurityInventoryItem[];
  remediationQueue: PurityInventoryItem[];
  firstPhysicalSplitPlan: PurityInventoryItem[];
}

const RETIRED_OWNER_PATH_TOKENS = ["features/local-data/", "features/platform-action/"] as const;
const PLACEHOLDER_SUCCESS_TOKENS = ["fake success", "fallback success", "no-op success", "todo success"] as const;

const createPurityFinding = (lawId: string, relativePath: string, line: number, message: string, detail?: string): Finding =>
  createFinding({ lawId, file: relativePath, line, severity: "error", message, ...(detail ? { detail } : {}) });

const countIfChain = (statement: IfStatement): number => {
  let count = 1;
  let current: IfStatement | undefined = statement;
  while (current) {
    const elseStatement = current.getElseStatement();
    if (!elseStatement || !Node.isIfStatement(elseStatement)) {
      break;
    }
    count += 1;
    current = elseStatement;
  }
  return count;
};

const isAnyOrUnknownTypeNode = (expression: AsExpression): boolean => {
  const typeNode = expression.getTypeNode();
  return typeNode?.getKind() === SyntaxKind.AnyKeyword || typeNode?.getKind() === SyntaxKind.UnknownKeyword;
};

const collectRoleMixingSignals = (sourceFile: SourceFile, relativePath: string, importedOwners: string[]): string[] => {
  const signals: string[] = [];
  if (isGenericBucketSourceFile(relativePath) && importedOwners.length > 1) {
    signals.push("generic-bucket");
  }
  if (sourceFile.getInterfaces().length > 0 && getFunctionNodes(sourceFile).length > 0 && !relativePath.endsWith("schema.ts")) {
    signals.push("schema-and-runtime");
  }
  if (sourceFile.getClasses().length > 0 && getFunctionNodes(sourceFile).length > 4) {
    signals.push("class-and-free-functions");
  }
  if ((sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 || sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0) && importedOwners.length > 2) {
    signals.push("jsx-plus-cross-owner-runtime");
  }
  return signals;
};

const inspectCleanupAndEscapes = (sourceFile: SourceFile, relativePath: string, findings: Finding[]): void => {
  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = callExpression.getExpression();
    if (Node.isPropertyAccessExpression(expression) && expression.getExpression().getText() === "console" && expression.getName() === "log") {
      findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-008-V1", relativePath, getNodeLine(callExpression), "console.log debug scatter is forbidden in the active code-purity scope."));
    }
    if (Node.isIdentifier(expression) && expression.getText() === "require") {
      findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-012-V1", relativePath, getNodeLine(callExpression), "require() is forbidden in active source truth."));
    }
    if (expression.getKind() === SyntaxKind.ImportKeyword) {
      findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-012-V1", relativePath, getNodeLine(callExpression), "dynamic import() is forbidden in active source truth unless separately governed."));
    }
  }

  for (const comment of collectCommentTokens(sourceFile)) {
    const lower = comment.text.toLowerCase();
    if (isTodoComment(comment.text) && !hasTodoHygiene(comment.text)) {
      findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-008-V1", relativePath, comment.line, "TODO or FIXME comment is missing owner, reason, or removal condition.", comment.text));
    }
    if (isCommentedOutCode(comment.text, relativePath)) {
      findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-008-V1", relativePath, comment.line, "Commented-out implementation code must be deleted from active source truth.", comment.text));
    }
    if (lower.includes("@ts-ignore") || lower.includes("@ts-expect-error") || lower.includes("eslint-disable")) {
      findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-012-V1", relativePath, comment.line, "TypeScript or ESLint suppression directives are forbidden in active source truth.", comment.text));
    }
  }

  for (const anyKeyword of sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword)) {
    findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-012-V1", relativePath, getNodeLine(anyKeyword), "any is forbidden in active source truth."));
  }
  for (const asExpression of sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression)) {
    if (isAnyOrUnknownTypeNode(asExpression)) {
      findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-012-V1", relativePath, getNodeLine(asExpression), "as any or as unknown chains are forbidden in active source truth."));
    }
  }
};

const createItem = (
  relativePath: string,
  lineCount: number,
  fileType: string,
  overLimitBy: number,
  functionsOverLimit: string[],
  classMembers: number,
  importCount: number,
  crossOwnerImports: number,
  ownerBoundaries: number,
  roleMixingSignals: string[],
): PurityInventoryItem => ({
  file: relativePath,
  lines: lineCount,
  fileType,
  overLimitBy,
  functionsOverLimit,
  classMembers,
  importCount,
  crossOwnerImports,
  ownerBoundaries,
  roleMixingSignals,
  severity: lineCount > DISASTER_LINE_THRESHOLD || ownerBoundaries > IMPORT_EXPORT_LIMITS.ownerBoundaries || crossOwnerImports > IMPORT_EXPORT_LIMITS.crossOwnerImports ? "DISASTER" : overLimitBy > 0 ? "BLOCKING" : "REMEDIATION",
  recommendedSplit: roleMixingSignals.length > 0 ? `Split ${fileType} by role: ${roleMixingSignals.join(", ")}.` : `Split ${fileType} by owner-local collaborators.`,
});

export const createEmptyPurityReport = (): PurityReportDraft => ({
  godFileInventory: [],
  disasterFileInventory: [],
  ownerMixingInventory: [],
  oversizedTouchedFileInventory: [],
  functionOverLimitInventory: [],
  classObjectOverLimitInventory: [],
  importExportOverLimitInventory: [],
  remediationQueue: [],
  firstPhysicalSplitPlan: [],
});

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
  const functionOverLimit: string[] = [];
  const classOverLimit: string[] = [];

  inspectCleanupAndEscapes(sourceFile, relativePath, findings);

  if (lineCount > category.hardLimit) {
    findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-001-V1", relativePath, 1, `File exceeds the ${category.label} hard limit of ${category.hardLimit} lines.`, String(lineCount)));
  }
  if (touchedPaths.has(relativePath) && lineCount > category.hardLimit) {
    findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-002-V1", relativePath, 1, "Touched file exceeds its code-purity hard limit and must be physically split before more logic is accepted."));
  }

  for (const functionNode of getFunctionNodes(sourceFile)) {
    const metrics = getFunctionMetrics(functionNode);
    const name = getFunctionName(functionNode, relativePath);
    const body = functionNode.getBody();
    const statements = body ? (Node.isBlock(body) ? body.getStatements().length : 1) : 0;
    const returns = functionNode.getDescendantsOfKind(SyntaxKind.ReturnStatement).length;
    const switchCases = functionNode.getDescendantsOfKind(SyntaxKind.CaseClause).length;
    const ifChain = Math.max(0, ...functionNode.getDescendantsOfKind(SyntaxKind.IfStatement).map((statement) => countIfChain(statement)));
    const booleanParameters = getBooleanLikeParameterCount(functionNode);
    const logicalLines = getLogicalLineCount(functionNode);
    if (logicalLines > FUNCTION_LIMITS.lines || statements > FUNCTION_LIMITS.statements || functionNode.getParameters().length > FUNCTION_LIMITS.parameters || returns > FUNCTION_LIMITS.returns || metrics.maxDepth > FUNCTION_LIMITS.depth || metrics.complexity > FUNCTION_LIMITS.complexity || switchCases > FUNCTION_LIMITS.switchCases || ifChain > FUNCTION_LIMITS.ifChain || booleanParameters > 1) {
      functionOverLimit.push(name);
      findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-003-V1", relativePath, functionNode.getStartLineNumber(), `Function ${name} exceeds code-purity function limits.`));
    }
    for (const catchClause of functionNode.getDescendantsOfKind(SyntaxKind.CatchClause)) {
      if (isSilentCatchClause(catchClause)) {
        findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-003-V1", relativePath, getNodeLine(catchClause), `Function ${name} contains a silent catch clause.`));
      }
    }
  }

  for (const classDeclaration of sourceFile.getClasses()) {
    const methods = classDeclaration.getMethods();
    const fields = classDeclaration.getProperties();
    const constructorParameters = classDeclaration.getConstructors()[0]?.getParameters().length ?? 0;
    const publicMethods = methods.filter((method) => method.getScope() !== "private" && method.getScope() !== "protected").length;
    if (methods.length > CLASS_LIMITS.methods || fields.length > CLASS_LIMITS.fields || classDeclaration.getMembers().length > CLASS_LIMITS.totalMembers || constructorParameters > CLASS_LIMITS.constructorParameters || publicMethods > CLASS_LIMITS.publicMethods) {
      classOverLimit.push(classDeclaration.getName() ?? `${relativePath}:${classDeclaration.getStartLineNumber()}`);
      findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-004-V1", relativePath, classDeclaration.getStartLineNumber(), "Class exceeds code-purity member or constructor limits."));
    }
  }

  if (importedOwners.length > IMPORT_EXPORT_LIMITS.ownerBoundaries || crossOwnerImports > IMPORT_EXPORT_LIMITS.crossOwnerImports) {
    findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-005-V1", relativePath, 1, "File crosses too many real owner boundaries or cross-owner imports."));
  }
  if (importDeclarations > IMPORT_EXPORT_LIMITS.importDeclarations || importSources > IMPORT_EXPORT_LIMITS.importSources || exportCount > IMPORT_EXPORT_LIMITS.exports) {
    findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-006-V1", relativePath, 1, "Import or export structure exceeds code-purity limits."));
  }
  for (const exportDeclaration of sourceFile.getExportDeclarations()) {
    if (exportDeclaration.isNamespaceExport() || exportDeclaration.getNamedExports().length === 0) {
      findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-006-V1", relativePath, getNodeLine(exportDeclaration), "export * is forbidden in active source truth."));
    }
  }
  if (sourceFile.getExportAssignments().length > 0 || sourceFile.getFunctions().some((fn) => fn.isDefaultExport()) || sourceFile.getClasses().some((klass) => klass.isDefaultExport())) {
    findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-006-V1", relativePath, 1, "Default export is forbidden unless explicitly governed by a domain law."));
  }

  if (roleMixingSignals.length > 0) {
    findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-007-V1", relativePath, 1, "File mixes multiple roles behind neutral or broad structure.", roleMixingSignals.join(", ")));
  }

  if (isProductionFakePath(relativePath) || hasProductionFakeImport(sourceFile)) {
    findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-008-V1", relativePath, 1, "Production source truth must not live under or import fake/mock/demo/fixture paths."));
  }
  for (const literal of [...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral), ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)]) {
    const text = literal.getLiteralText().toLowerCase();
    if (RETIRED_OWNER_PATH_TOKENS.some((token) => text.includes(token))) {
      findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-008-V1", relativePath, getNodeLine(literal), "Retired owner paths must not survive in active source truth.", text));
    }
    if (PLACEHOLDER_SUCCESS_TOKENS.some((token) => text.includes(token))) {
      findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-008-V1", relativePath, getNodeLine(literal), "Fake, fallback, no-op, or TODO success markers are forbidden in active source truth.", text));
    }
  }

  const fileName = relativePath.toLowerCase();
  if (["bridge", "compat", "legacy"].some((token) => fileName.includes(token))) {
    findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-009-V1", relativePath, 1, "Compatibility bridge or legacy duplicate path naming is forbidden in active source truth."));
    findings.push(createPurityFinding("GRASSEYE-CODE-PURITY-014-V1", relativePath, 1, "Physical remediation must remove bridge-style files instead of preserving duplicate paths."));
  }

  const item = createItem(relativePath, lineCount, category.label, Math.max(0, lineCount - category.hardLimit), functionOverLimit, Math.max(0, ...sourceFile.getClasses().map((klass) => klass.getMembers().length), 0), importDeclarations, crossOwnerImports, importedOwners.length, roleMixingSignals);
  if (lineCount > category.hardLimit) {
    report.godFileInventory.push(item);
  }
  if (lineCount > DISASTER_LINE_THRESHOLD || crossOwnerImports > IMPORT_EXPORT_LIMITS.crossOwnerImports || importedOwners.length > IMPORT_EXPORT_LIMITS.ownerBoundaries || roleMixingSignals.length > 0) {
    report.disasterFileInventory.push(item);
  }
  if (importedOwners.length > IMPORT_EXPORT_LIMITS.ownerBoundaries || crossOwnerImports > IMPORT_EXPORT_LIMITS.crossOwnerImports) {
    report.ownerMixingInventory.push(item);
  }
  if (touchedPaths.has(relativePath) && lineCount > category.hardLimit) {
    report.oversizedTouchedFileInventory.push(item);
  }
  if (functionOverLimit.length > 0) {
    report.functionOverLimitInventory.push(item);
  }
  if (classOverLimit.length > 0) {
    report.classObjectOverLimitInventory.push(item);
  }
  if (importDeclarations > IMPORT_EXPORT_LIMITS.importDeclarations || importSources > IMPORT_EXPORT_LIMITS.importSources || exportCount > IMPORT_EXPORT_LIMITS.exports) {
    report.importExportOverLimitInventory.push(item);
  }

  return findings;
};