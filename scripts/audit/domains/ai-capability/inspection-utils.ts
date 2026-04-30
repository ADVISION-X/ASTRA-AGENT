import { Node, SyntaxKind, type ArrayLiteralExpression, type ImportDeclaration, type Project, type SourceFile } from "ts-morph";

import { toRepoRelativePath } from "../../core/paths.js";
import { getSourceFileOrThrow } from "../_shared/ast-helpers.js";

import { aiInspectionConstants } from "./inspection-constants.js";

const { AI_ROOT } = aiInspectionConstants;

function getAiSources(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${AI_ROOT}/`));
}

function getSourceOrThrow(project: Project, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}

function getArrayStringLiterals(sourceFile: SourceFile, variableName: string): string[] {
  const variable = sourceFile.getVariableDeclaration(variableName);
  const initializer = variable?.getInitializer();
  const arrayLiteral = getArrayLiteral(initializer);
  return arrayLiteral
    ? arrayLiteral.getElements().flatMap((element) => (Node.isStringLiteral(element) ? [element.getLiteralText()] : []))
    : [];
}

function getArrayLiteral(initializer: Node | undefined): ArrayLiteralExpression | null {
  if (!initializer) {
    return null;
  }

  if (Node.isArrayLiteralExpression(initializer)) {
    return initializer;
  }

  if (!Node.isAsExpression(initializer)) {
    return null;
  }

  const expression = initializer.getExpression();
  return Node.isArrayLiteralExpression(expression) ? expression : null;
}

function getImportSpecifierText(importDeclaration: ImportDeclaration): string {
  const moduleSpecifier = importDeclaration.getModuleSpecifier();
  return Node.isStringLiteral(moduleSpecifier) || Node.isNoSubstitutionTemplateLiteral(moduleSpecifier)
    ? moduleSpecifier.getLiteralText()
    : moduleSpecifier.getText().slice(1, -1);
}

function getReturnArrayLiterals(sourceFile: SourceFile, functionName: string): string[] {
  const fn = sourceFile.getFunction(functionName);
  const returned = fn?.getDescendantsOfKind(SyntaxKind.ReturnStatement).find((statement) => Node.isArrayLiteralExpression(statement.getExpression()));
  const arrayLiteral = returned?.getExpressionIfKind(SyntaxKind.ArrayLiteralExpression);
  return arrayLiteral
    ? arrayLiteral.getElements().flatMap((element) => (Node.isStringLiteral(element) ? [element.getLiteralText()] : []))
    : [];
}

function getObjectPropertyStringArray(sourceFile: SourceFile, variableName: string): string[] {
  const variable = sourceFile.getVariableDeclaration(variableName);
  const initializer = variable?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
  if (!initializer) {
    return [];
  }

  const values: string[] = [];
  for (const property of initializer.getProperties()) {
    if (!Node.isPropertyAssignment(property)) {
      continue;
    }
    const value = property.getInitializerIfKind(SyntaxKind.StringLiteral);
    if (value) {
      values.push(value.getLiteralText());
    }
  }

  return values;
}

function hasNewDateOutsideClock(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "Date");
}

function hasDynamicImportOrRequire(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return expression.getKind() === SyntaxKind.ImportKeyword || expression.getText() === "require";
  });
}

function hasForbiddenRecordAssertion(sourceFile: SourceFile, repoPath: string): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).some((expression) => {
    const typeText = expression.getTypeNode()?.getText() ?? "";
    if (typeText !== "Record<string, unknown>") {
      return false;
    }
    return repoPath !== `${AI_ROOT}/runtime/ai-dispatch-failure.ts`
      || expression.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration)?.getName() !== "readFailureEnvelopeRawRecord";
  });
}

function hasChildLocalSchemaShape(sourceFile: SourceFile, childNamePrefix: string): boolean {
  const exportedNames = new Set(sourceFile.getExportedDeclarations().keys());
  const hasPolicySchema = exportedNames.has(`${childNamePrefix}ChildExecutionPolicySchema`)
    || exportedNames.has(`${childNamePrefix}ChildRuntimePolicySchema`);
  return exportedNames.has(`${childNamePrefix}ChildInputSchema`)
    && exportedNames.has(`${childNamePrefix}ChildResultSchema`)
    && hasPolicySchema
    && sourceFile.getExportDeclarations().length === 0;
}

function hasChildContractShape(sourceFile: SourceFile, childNamePrefix: string): boolean {
  const exportedNames = new Set(sourceFile.getExportedDeclarations().keys());
  return [...exportedNames].some((name) => name.endsWith("_CHILD_ID"))
    && exportedNames.has(`${childNamePrefix}ChildContract`)
    && exportedNames.has(`${childNamePrefix}ChildExecutionPolicy`)
    && sourceFile.getExportDeclarations().length === 0;
}

function getReferencesCount(sourceFile: SourceFile, name: string): number {
  const declaration = sourceFile.getFunction(name)
    ?? sourceFile.getVariableDeclaration(name)
    ?? sourceFile.getExportedDeclarations().get(name)?.at(0)
    ?? null;
  if (!declaration) {
    return 0;
  }

  const referenceNode = Node.isVariableDeclaration(declaration)
    ? declaration.getNameNode()
    : "getNameNode" in declaration && typeof declaration.getNameNode === "function"
      ? declaration.getNameNode()
      : declaration;
  return Node.isIdentifier(referenceNode) ? referenceNode.findReferencesAsNodes().length : 0;
}

function toChildNamePrefix(childId: string): string {
  return childId
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join("");
}

export const aiInspectionUtils = {
  getAiSources,
  getSourceOrThrow,
  getArrayStringLiterals,
  getImportSpecifierText,
  getReturnArrayLiterals,
  getObjectPropertyStringArray,
  hasNewDateOutsideClock,
  hasDynamicImportOrRequire,
  hasForbiddenRecordAssertion,
  hasChildLocalSchemaShape,
  hasChildContractShape,
  getReferencesCount,
  toChildNamePrefix,
} as const;