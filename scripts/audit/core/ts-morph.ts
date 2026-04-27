import { Node, Project, SyntaxKind, type CallExpression, type Expression, type Identifier, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { pathFromRepoRoot, toRepoRelativePath } from "./paths.js";

let cachedProject: Project | undefined;

export const getAuditProject = (): Project => {
  if (!cachedProject) {
    cachedProject = new Project({
      tsConfigFilePath: pathFromRepoRoot("tsconfig.json"),
      skipAddingFilesFromTsConfig: false,
    });
  }

  return cachedProject;
};

export const getSourceFileOrThrow = (project: Project, relativePath: string): SourceFile => {
  const sourceFile = project.getSourceFile(pathFromRepoRoot(relativePath));
  if (!sourceFile) {
    throw new Error(`Source file not found in ts-morph project: ${relativePath}`);
  }

  return sourceFile;
};

export const getNodeLine = (node: Node): number => node.getStartLineNumber();

export const toRelativeSourcePath = (sourceFile: SourceFile): string =>
  toRepoRelativePath(sourceFile.getFilePath());

export const getExpressionPath = (expression: Expression | undefined): string[] => {
  if (!expression) {
    return [];
  }

  if (Node.isPropertyAccessExpression(expression)) {
    return [...getExpressionPath(expression.getExpression()), expression.getName()];
  }

  if (Node.isIdentifier(expression)) {
    return [expression.getText()];
  }

  if (Node.isThisExpression(expression)) {
    return ["this"];
  }

  return [];
};

export const isCallPath = (callExpression: CallExpression, expectedPath: string[]): boolean => {
  const actualPath = getExpressionPath(callExpression.getExpression());
  return actualPath.length === expectedPath.length && actualPath.every((segment, index) => segment === expectedPath[index]);
};

export const getObjectLiteralString = (
  objectLiteral: ObjectLiteralExpression,
  propertyName: string,
): string | undefined => {
  const property = objectLiteral.getProperty(propertyName);
  if (!property || !Node.isPropertyAssignment(property)) {
    return undefined;
  }

  const initializer = property.getInitializer();
  if (!initializer) {
    return undefined;
  }

  if (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer)) {
    return initializer.getLiteralText();
  }

  return undefined;
};

export const getReferencePaths = (identifier: Identifier): string[] => {
  const paths = new Set<string>();
  for (const referenceNode of identifier.findReferencesAsNodes()) {
    paths.add(toRelativeSourcePath(referenceNode.getSourceFile()));
  }

  return [...paths].sort((left, right) => left.localeCompare(right));
};

export const isInsideNamedMethod = (node: Node, methodName: string): boolean => {
  const method = node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration);
  return method?.getName() === methodName;
};