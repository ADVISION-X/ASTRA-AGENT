import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { toRepoRelativePath } from "./inspection-core.js";
import { visualTargetInspectionConstants as config } from "./inspection-constants.js";

const toRootRelative = (sourceFile: SourceFile): string => toRepoRelativePath(sourceFile.getFilePath());

export const getVisualTargetSourceFiles = (project: Project): SourceFile[] => {
  return project.getSourceFiles().filter((sourceFile) => toRootRelative(sourceFile).startsWith(`${config.ROOT}/`));
};

export const hasWildcardExport = (sourceFile: SourceFile): boolean => {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.getNamedExports().length === 0);
};

const hasCoordinateSpaceExcludeCall = (callExpression: import("ts-morph").CallExpression): boolean => {
  const expression = callExpression.getExpression();
  return Node.isPropertyAccessExpression(expression)
    && expression.getName() === "exclude"
    && expression.getExpression().getText() === "VisualTargetCoordinateSpaceSchema";
};

const getExcludeArgumentValues = (callExpression: import("ts-morph").CallExpression): Set<string> => {
  const [firstArgument] = callExpression.getArguments();
  if (!firstArgument || !Node.isArrayLiteralExpression(firstArgument)) {
    return new Set();
  }

  return new Set(firstArgument.getElements().flatMap((element) => Node.isStringLiteral(element) ? [element.getLiteralText()] : []));
};

export const hasCoordinateSpaceExclusion = (sourceFile: SourceFile, schemaName: string, exclusions: readonly string[]): boolean => {
  const declaration = sourceFile.getVariableDeclaration(schemaName);
  if (!declaration) {
    return false;
  }

  return declaration.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    return hasCoordinateSpaceExcludeCall(callExpression)
      && exclusions.every((value) => getExcludeArgumentValues(callExpression).has(value));
  });
};

const getObjectLiteralPropertyNames = (node: Node | undefined): Set<string> => {
  if (!node || !Node.isObjectLiteralExpression(node)) {
    return new Set();
  }

  return new Set(node.getProperties().flatMap((property) => {
    return Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property) ? [property.getName()] : [];
  }));
};

const isShapePassthroughCall = (expression: Node): boolean => {
  return Node.isPropertyAccessExpression(expression)
    && (expression.getName() === "strict" || expression.getName() === "superRefine");
};

const isShapeExtendCall = (expression: Node): expression is import("ts-morph").PropertyAccessExpression => {
  return Node.isPropertyAccessExpression(expression) && expression.getName() === "extend";
};

const collectExtendedShapePropertyNames = (node: import("ts-morph").CallExpression, expression: import("ts-morph").PropertyAccessExpression): Set<string> => {
  const base = collectZodShapePropertyNames(expression.getExpression());
  for (const propertyName of getObjectLiteralPropertyNames(node.getArguments()[0])) {
    base.add(propertyName);
  }
  return base;
};

const collectZodShapePropertyNames = (node: Node | undefined): Set<string> => {
  if (!node || !Node.isCallExpression(node)) {
    return new Set();
  }

  const expression = node.getExpression();
  if (isShapePassthroughCall(expression)) {
    return collectZodShapePropertyNames(expression.getExpression());
  }
  if (isShapeExtendCall(expression)) {
    return collectExtendedShapePropertyNames(node, expression);
  }

  return getObjectLiteralPropertyNames(node.getArguments()[0]);
};

export const getZodShapePropertyNames = (sourceFile: SourceFile, declarationName: string): Set<string> => {
  return collectZodShapePropertyNames(sourceFile.getVariableDeclaration(declarationName)?.getInitializer());
};