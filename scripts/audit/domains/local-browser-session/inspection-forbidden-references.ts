import { Node, SyntaxKind, type CallExpression, type PropertyAccessExpression, type SourceFile } from "ts-morph";

import { getNodeLine } from "../../core/ts-morph.js";

import { localBrowserSessionInspectionConstants as config } from "./inspection-constants.js";

const getExpressionPath = (node: Node | undefined): string[] => {
  if (!node) {
    return [];
  }
  if (Node.isPropertyAccessExpression(node)) {
    return [...getExpressionPath(node.getExpression()), node.getName()];
  }
  if (Node.isIdentifier(node)) {
    return [node.getText()];
  }
  if (Node.isElementAccessExpression(node)) {
    const argument = node.getArgumentExpression();
    if (argument && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))) {
      return [...getExpressionPath(node.getExpression()), argument.getLiteralText()];
    }
  }
  return [];
};

const getForbiddenModuleSpecifier = (moduleSpecifier: string): string | null => {
  return config.FORBIDDEN_IMPORT_SPECIFIERS.includes(moduleSpecifier as (typeof config.FORBIDDEN_IMPORT_SPECIFIERS)[number]) || moduleSpecifier.includes("playwright-browser-controller")
    ? moduleSpecifier
    : null;
};

const getForbiddenImportReference = (sourceFile: SourceFile): { line: number; detail: string } | null => {
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = getForbiddenModuleSpecifier(importDeclaration.getModuleSpecifierValue());
    if (moduleSpecifier) {
      return { line: getNodeLine(importDeclaration), detail: `forbidden import ${moduleSpecifier}` };
    }
  }
  return null;
};

const getForbiddenExportReference = (sourceFile: SourceFile): { line: number; detail: string } | null => {
  for (const exportDeclaration of sourceFile.getExportDeclarations()) {
    const moduleSpecifier = exportDeclaration.getModuleSpecifierValue();
    const forbiddenSpecifier = moduleSpecifier ? getForbiddenModuleSpecifier(moduleSpecifier) : null;
    if (forbiddenSpecifier) {
      return { line: getNodeLine(exportDeclaration), detail: `forbidden export ${forbiddenSpecifier}` };
    }
  }
  return null;
};

const getModuleLoadSpecifier = (callExpression: CallExpression): string | null => {
  const firstArgument = callExpression.getArguments()[0];
  if (!firstArgument) {
    return null;
  }
  return Node.isStringLiteral(firstArgument) || Node.isNoSubstitutionTemplateLiteral(firstArgument)
    ? firstArgument.getLiteralText()
    : null;
};

const isForbiddenModuleLoad = (callExpression: CallExpression): boolean => {
  const expression = callExpression.getExpression();
  return (Node.isIdentifier(expression) && expression.getText() === "require") || expression.getKind() === SyntaxKind.ImportKeyword;
};

const getForbiddenModuleLoadReference = (sourceFile: SourceFile): { line: number; detail: string } | null => {
  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const moduleSpecifier = getModuleLoadSpecifier(callExpression);
    const forbiddenSpecifier = moduleSpecifier ? getForbiddenModuleSpecifier(moduleSpecifier) : null;
    if (forbiddenSpecifier && isForbiddenModuleLoad(callExpression)) {
      return { line: getNodeLine(callExpression), detail: `forbidden module load ${forbiddenSpecifier}` };
    }
  }
  return null;
};

const getForbiddenIdentifierUsage = (sourceFile: SourceFile): { line: number; detail: string } | null => {
  for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    if (config.FORBIDDEN_IDENTIFIER_NAMES.includes(identifier.getText() as (typeof config.FORBIDDEN_IDENTIFIER_NAMES)[number])) {
      return { line: getNodeLine(identifier), detail: `forbidden identifier ${identifier.getText()}` };
    }
  }
  return null;
};

const getForbiddenNamedPropertyUsage = (propertyAccess: PropertyAccessExpression): { line: number; detail: string } | null => {
  if (config.FORBIDDEN_PROPERTY_NAMES.includes(propertyAccess.getName() as (typeof config.FORBIDDEN_PROPERTY_NAMES)[number])) {
    return { line: getNodeLine(propertyAccess), detail: `forbidden property access ${propertyAccess.getName()}` };
  }
  return null;
};

const getForbiddenBrowserLaunchPathUsage = (propertyAccess: PropertyAccessExpression, pathParts: string[]): { line: number; detail: string } | null => {
  if (pathParts.length === 2 && pathParts[0] === "chromium" && (pathParts[1] === "launchPersistentContext" || pathParts[1] === "launch")) {
    return { line: getNodeLine(propertyAccess), detail: `forbidden browser launch path ${pathParts.join(".")}` };
  }
  return null;
};

const getForbiddenEnvPathUsage = (propertyAccess: PropertyAccessExpression, pathParts: string[]): { line: number; detail: string } | null => {
  if (pathParts.length === 3 && pathParts[0] === "process" && pathParts[1] === "env" && config.FORBIDDEN_ENV_KEYS.includes(pathParts[2] as (typeof config.FORBIDDEN_ENV_KEYS)[number])) {
    return { line: getNodeLine(propertyAccess), detail: `forbidden env ${pathParts[2]}` };
  }
  return null;
};

const getForbiddenPathPropertyUsage = (propertyAccess: PropertyAccessExpression): { line: number; detail: string } | null => {
  const pathParts = getExpressionPath(propertyAccess);
  return getForbiddenBrowserLaunchPathUsage(propertyAccess, pathParts) ?? getForbiddenEnvPathUsage(propertyAccess, pathParts);
};

const getForbiddenPropertyUsage = (sourceFile: SourceFile): { line: number; detail: string } | null => {
  for (const propertyAccess of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    const forbiddenUsage = getForbiddenNamedPropertyUsage(propertyAccess) ?? getForbiddenPathPropertyUsage(propertyAccess);
    if (forbiddenUsage) {
      return forbiddenUsage;
    }
  }
  return null;
};

const hasForbiddenModuleReference = (sourceFile: SourceFile): { line: number; detail: string } | null => {
  return getForbiddenImportReference(sourceFile)
    ?? getForbiddenExportReference(sourceFile)
    ?? getForbiddenModuleLoadReference(sourceFile);
};

const hasForbiddenApiUsage = (sourceFile: SourceFile): { line: number; detail: string } | null => {
  return getForbiddenIdentifierUsage(sourceFile) ?? getForbiddenPropertyUsage(sourceFile);
};

export const localBrowserSessionForbiddenReferences = {
  hasForbiddenApiUsage,
  hasForbiddenModuleReference,
};