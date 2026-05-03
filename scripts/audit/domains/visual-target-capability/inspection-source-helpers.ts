import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { toRepoRelativePath } from "./inspection-core.js";
import { visualTargetInspectionConstants as config } from "./inspection-constants.js";

const toRootRelative = (sourceFile: SourceFile): string => toRepoRelativePath(sourceFile.getFilePath());

const unwrapObjectLiteralNode = (node: Node | undefined): import("ts-morph").ObjectLiteralExpression | null => {
  if (!node) {
    return null;
  }
  if (Node.isObjectLiteralExpression(node)) {
    return node;
  }
  if (Node.isSatisfiesExpression(node) || Node.isAsExpression(node) || Node.isParenthesizedExpression(node)) {
    return unwrapObjectLiteralNode(node.getExpression());
  }
  return null;
};

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
  const objectLiteral = unwrapObjectLiteralNode(node);
  if (!objectLiteral) {
    return new Set();
  }

  return new Set(objectLiteral.getProperties().flatMap((property) => {
    if (Node.isSpreadAssignment(property)) {
      const expression = property.getExpression();
      if (!Node.isIdentifier(expression)) {
        return [];
      }
      const symbol = expression.getSymbol();
      const target = symbol?.getAliasedSymbol() ?? symbol;
      const declaration = target?.getDeclarations()[0];
      return Node.isVariableDeclaration(declaration)
        ? [...getObjectLiteralPropertyNames(declaration.getInitializer())]
        : [];
    }
    return Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property) ? [property.getName()] : [];
  }));
};

const isShapePassthroughCall = (expression: Node): expression is import("ts-morph").PropertyAccessExpression => {
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

const resolveIdentifierInitializer = (node: import("ts-morph").Identifier): Node | undefined => {
  const declaration = node.getSymbol()?.getAliasedSymbol()?.getDeclarations()[0] ?? node.getSymbol()?.getDeclarations()[0];
  return Node.isVariableDeclaration(declaration) ? declaration.getInitializer() : undefined;
};

const collectIdentifierShapePropertyNames = (node: import("ts-morph").Identifier): Set<string> => {
  return collectZodShapePropertyNames(resolveIdentifierInitializer(node));
};

const collectCallShapePropertyNames = (node: import("ts-morph").CallExpression): Set<string> => {
  const expression = node.getExpression();
  if (isShapePassthroughCall(expression)) {
    return collectZodShapePropertyNames(expression.getExpression());
  }
  if (isShapeExtendCall(expression)) {
    return collectExtendedShapePropertyNames(node, expression);
  }

  return getObjectLiteralPropertyNames(node.getArguments()[0]);
};

const collectZodShapePropertyNames = (node: Node | undefined): Set<string> => {
  if (!node) {
    return new Set();
  }
  if (Node.isIdentifier(node)) {
    return collectIdentifierShapePropertyNames(node);
  }
  if (!Node.isCallExpression(node)) {
    return new Set();
  }

  return collectCallShapePropertyNames(node);
};

export const getZodShapePropertyNames = (sourceFile: SourceFile, declarationName: string): Set<string> => {
  return collectZodShapePropertyNames(sourceFile.getVariableDeclaration(declarationName)?.getInitializer());
};