import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";

import { pathFromRepoRoot } from "./inspection-core.js";

export const createAuditProject = (): Project => {
  return new Project({
    tsConfigFilePath: pathFromRepoRoot("tsconfig.json"),
    skipAddingFilesFromTsConfig: false,
  });
};

export const getSourceFileOrThrow = (project: Project, repoRelativePath: string): SourceFile => {
  const sourceFile = project.getSourceFile(pathFromRepoRoot(repoRelativePath));
  if (!sourceFile) {
    throw new Error(`Missing source file: ${repoRelativePath}`);
  }

  return sourceFile;
};

export const hasAnyKeyword = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword).length > 0;
};

export const getZodObjectPropertyNames = (sourceFile: SourceFile, declarationName: string): Set<string> => {
  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const initializer = declaration?.getInitializer();
  const objectCall = initializer && Node.isCallExpression(initializer) && isZodObjectCall(initializer)
    ? initializer
    : initializer?.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => isZodObjectCall(callExpression));
  const firstArgument = objectCall?.getArguments()[0];
  if (!firstArgument || !Node.isObjectLiteralExpression(firstArgument)) {
    return new Set();
  }

  return new Set(firstArgument.getProperties().flatMap((property) => {
    return Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)
      ? [property.getName()]
      : [];
  }));
};

export const getTypeAliasPropertyNames = (sourceFile: SourceFile, declarationName: string): Set<string> => {
  const declaration = sourceFile.getTypeAlias(declarationName);
  const typeNode = declaration?.getTypeNode();
  if (!typeNode || !Node.isTypeLiteral(typeNode)) {
    return new Set();
  }

  return new Set(typeNode.getProperties().flatMap((property) => {
    return Node.isPropertySignature(property) ? [property.getName()] : [];
  }));
};

const flattenPropertyAccessMember = (node: Node): string[] | null => {
  return Node.isPropertyAccessExpression(node)
    ? [...flattenPropertyAccess(node.getExpression()), node.getName()]
    : null;
};

const flattenPropertyAccessIdentifier = (node: Node): string[] | null => {
  return Node.isIdentifier(node) ? [node.getText()] : null;
};

const flattenPropertyAccessThis = (node: Node): string[] | null => {
  return node.getKind() === SyntaxKind.ThisKeyword ? ["this"] : null;
};

const flattenPropertyAccess = (node: Node | undefined): string[] => {
  if (!node) {
    return [];
  }

  return flattenPropertyAccessMember(node)
    ?? flattenPropertyAccessIdentifier(node)
    ?? flattenPropertyAccessThis(node)
    ?? [];
};

export const hasConsoleLog = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression) && flattenPropertyAccess(expression).join(".") === "console.log";
  });
};

const isZodObjectCall = (callExpression: Node): boolean => {
  if (!Node.isCallExpression(callExpression)) {
    return false;
  }

  const expression = callExpression.getExpression();
  return Node.isPropertyAccessExpression(expression)
    && expression.getExpression().getText() === "z"
    && expression.getName() === "object";
};