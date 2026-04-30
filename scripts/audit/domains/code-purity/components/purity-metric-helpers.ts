import { Node, SyntaxKind, type AsExpression, type IfStatement, type SourceFile } from "ts-morph";

import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import { getNodeLine } from "../../../core/ts-morph.js";
import { collectCommentTokens, hasTodoHygiene, isCommentedOutCode, isTodoComment } from "./purity-comment-analysis.js";
import { CLASS_LIMITS, FUNCTION_LIMITS, IMPORT_EXPORT_LIMITS } from "./purity-constants.js";
import { hasProductionFakeImport, isGenericBucketSourceFile, isProductionFakePath } from "./purity-file-classification.js";
import { getBooleanLikeParameterCount, getFunctionMetrics, getFunctionName, getFunctionNodes, getLogicalLineCount, isSilentCatchClause } from "./purity-function-analysis.js";

const RETIRED_OWNER_PATH_TOKENS = ["features/" + "local-data/", "features/" + "platform-action/"] as const;
const PLACEHOLDER_SUCCESS_TOKENS = [
  ["fake", "success"].join(" "),
  ["fallback", "success"].join(" "),
  ["no-op", "success"].join(" "),
  ["todo", "success"].join(" "),
] as const;

type PurityFindingInput = {
  lawId: string;
  relativePath: string;
  line: number;
  message: string;
  detail?: string;
};

export const createPurityFinding = ({ lawId, relativePath, line, message, detail }: PurityFindingInput): Finding =>
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

const hasJsxCrossOwnerRuntimeSignal = (sourceFile: SourceFile, importedOwners: string[]): boolean =>
  (sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 || sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0)
  && importedOwners.length > 2;

export const collectRoleMixingSignals = (sourceFile: SourceFile, relativePath: string, importedOwners: string[]): string[] => {
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
  if (hasJsxCrossOwnerRuntimeSignal(sourceFile, importedOwners)) {
    signals.push("jsx-plus-cross-owner-runtime");
  }
  return signals;
};

const inspectCallExpressionEscapes = (sourceFile: SourceFile, relativePath: string, findings: Finding[]): void => {
  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = callExpression.getExpression();
    if (Node.isPropertyAccessExpression(expression) && expression.getExpression().getText() === "console" && expression.getName() === "log") {
      findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-008-V1", relativePath, line: getNodeLine(callExpression), message: "console.log debug scatter is forbidden in the active code-purity scope." }));
    }
    if (Node.isIdentifier(expression) && expression.getText() === "require") {
      findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-012-V1", relativePath, line: getNodeLine(callExpression), message: "require() is forbidden in active source truth." }));
    }
    if (expression.getKind() === SyntaxKind.ImportKeyword) {
      findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-012-V1", relativePath, line: getNodeLine(callExpression), message: "dynamic import() is forbidden in active source truth unless separately governed." }));
    }
  }
};

const inspectCommentAndTypeEscapes = (sourceFile: SourceFile, relativePath: string, findings: Finding[]): void => {
  for (const comment of collectCommentTokens(sourceFile)) {
    const lower = comment.text.toLowerCase();
    if (isTodoComment(comment.text) && !hasTodoHygiene(comment.text)) {
      findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-008-V1", relativePath, line: comment.line, message: "TODO or FIXME comment is missing owner, reason, or removal condition.", detail: comment.text }));
    }
    if (isCommentedOutCode(comment.text, relativePath)) {
      findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-008-V1", relativePath, line: comment.line, message: "Commented-out implementation code must be deleted from active source truth.", detail: comment.text }));
    }
    if (lower.includes("@ts-ignore") || lower.includes("@ts-expect-error") || lower.includes("eslint-disable")) {
      findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-012-V1", relativePath, line: comment.line, message: "TypeScript or ESLint suppression directives are forbidden in active source truth.", detail: comment.text }));
    }
  }

  for (const anyKeyword of sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword)) {
    findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-012-V1", relativePath, line: getNodeLine(anyKeyword), message: "any is forbidden in active source truth." }));
  }
  for (const asExpression of sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression)) {
    if (isAnyOrUnknownTypeNode(asExpression)) {
      findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-012-V1", relativePath, line: getNodeLine(asExpression), message: "as any or as unknown chains are forbidden in active source truth." }));
    }
  }
};

export const inspectCleanupAndEscapes = (sourceFile: SourceFile, relativePath: string, findings: Finding[]): void => {
  inspectCallExpressionEscapes(sourceFile, relativePath, findings);
  inspectCommentAndTypeEscapes(sourceFile, relativePath, findings);
};

export const inspectFunctionLimits = (sourceFile: SourceFile, relativePath: string, findings: Finding[]): string[] => {
  const functionOverLimit: string[] = [];
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
      findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-003-V1", relativePath, line: functionNode.getStartLineNumber(), message: `Function ${name} exceeds code-purity function limits.` }));
    }
    for (const catchClause of functionNode.getDescendantsOfKind(SyntaxKind.CatchClause)) {
      if (isSilentCatchClause(catchClause)) {
        findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-003-V1", relativePath, line: getNodeLine(catchClause), message: `Function ${name} contains a silent catch clause.` }));
      }
    }
  }

  return functionOverLimit;
};

export const inspectClassLimits = (sourceFile: SourceFile, relativePath: string, findings: Finding[]): { classOverLimit: string[]; maxClassMembers: number } => {
  const classOverLimit: string[] = [];
  const maxClassMembers = Math.max(0, ...sourceFile.getClasses().map((klass) => klass.getMembers().length), 0);

  for (const classDeclaration of sourceFile.getClasses()) {
    const methods = classDeclaration.getMethods();
    const fields = classDeclaration.getProperties();
    const constructorParameters = classDeclaration.getConstructors()[0]?.getParameters().length ?? 0;
    const publicMethods = methods.filter((method) => method.getScope() !== "private" && method.getScope() !== "protected").length;
    if (methods.length > CLASS_LIMITS.methods || fields.length > CLASS_LIMITS.fields || classDeclaration.getMembers().length > CLASS_LIMITS.totalMembers || constructorParameters > CLASS_LIMITS.constructorParameters || publicMethods > CLASS_LIMITS.publicMethods) {
      classOverLimit.push(classDeclaration.getName() ?? `${relativePath}:${classDeclaration.getStartLineNumber()}`);
      findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-004-V1", relativePath, line: classDeclaration.getStartLineNumber(), message: "Class exceeds code-purity member or constructor limits." }));
    }
  }

  return { classOverLimit, maxClassMembers };
};

export const inspectBoundaryAndExportLimits = (input: {
  sourceFile: SourceFile;
  relativePath: string;
  findings: Finding[];
  importedOwners: string[];
  crossOwnerImports: number;
  importDeclarations: number;
  importSources: number;
  exportCount: number;
  roleMixingSignals: string[];
}): void => {
  const { sourceFile, relativePath, findings, importedOwners, crossOwnerImports, importDeclarations, importSources, exportCount, roleMixingSignals } = input;

  if (importedOwners.length > IMPORT_EXPORT_LIMITS.ownerBoundaries || crossOwnerImports > IMPORT_EXPORT_LIMITS.crossOwnerImports) {
    findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-005-V1", relativePath, line: 1, message: "File crosses too many real owner boundaries or cross-owner imports." }));
  }
  if (importDeclarations > IMPORT_EXPORT_LIMITS.importDeclarations || importSources > IMPORT_EXPORT_LIMITS.importSources || exportCount > IMPORT_EXPORT_LIMITS.exports) {
    findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-006-V1", relativePath, line: 1, message: "Import or export structure exceeds code-purity limits." }));
  }
  for (const exportDeclaration of sourceFile.getExportDeclarations()) {
    if (exportDeclaration.isNamespaceExport() || exportDeclaration.getNamedExports().length === 0) {
      findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-006-V1", relativePath, line: getNodeLine(exportDeclaration), message: "export * is forbidden in active source truth." }));
    }
  }
  if (sourceFile.getExportAssignments().length > 0 || sourceFile.getFunctions().some((fn) => fn.isDefaultExport()) || sourceFile.getClasses().some((klass) => klass.isDefaultExport())) {
    findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-006-V1", relativePath, line: 1, message: "Default export is forbidden unless explicitly governed by a domain law." }));
  }

  if (roleMixingSignals.length > 0) {
    findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-007-V1", relativePath, line: 1, message: "File mixes multiple roles behind neutral or broad structure.", detail: roleMixingSignals.join(", ") }));
  }
};

export const inspectLiteralAndPathPurity = (sourceFile: SourceFile, relativePath: string, findings: Finding[]): void => {
  if (isProductionFakePath(relativePath) || hasProductionFakeImport(sourceFile)) {
    findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-008-V1", relativePath, line: 1, message: "Production source truth must not live under or import fake/mock/demo/fixture paths." }));
  }
  for (const literal of [...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral), ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)]) {
    const text = literal.getLiteralText().toLowerCase();
    if (RETIRED_OWNER_PATH_TOKENS.some((token) => text.includes(token))) {
      findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-008-V1", relativePath, line: getNodeLine(literal), message: "Retired owner paths must not survive in active source truth.", detail: text }));
    }
    if (PLACEHOLDER_SUCCESS_TOKENS.some((token) => text.includes(token))) {
      findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-008-V1", relativePath, line: getNodeLine(literal), message: "Fake, fallback, no-op, or TODO " + "success markers are forbidden in active source truth.", detail: text }));
    }
  }

  const fileName = relativePath.toLowerCase();
  if (["bridge", "compat", "legacy"].some((token) => fileName.includes(token))) {
    findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-009-V1", relativePath, line: 1, message: "Compatibility bridge or legacy duplicate path naming is forbidden in active source truth." }));
    findings.push(createPurityFinding({ lawId: "GRASSEYE-CODE-PURITY-014-V1", relativePath, line: 1, message: "Physical remediation must remove bridge-style files instead of preserving duplicate paths." }));
  }
};