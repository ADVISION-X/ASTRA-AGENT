import { Node, Project, type CallExpression, type Expression, type Identifier, type ObjectLiteralExpression, type SourceFile, type VariableDeclaration } from "ts-morph";

import { pathFromRepoRoot, toRepoRelativePath } from "./paths.js";

let cachedProject: Project | undefined;

export const resetAuditProject = (): void => {
  cachedProject = undefined;
};

export const getAuditProject = (): Project => {
  if (!cachedProject) {
    cachedProject = new Project({
      tsConfigFilePath: pathFromRepoRoot("tsconfig.json"),
      skipAddingFilesFromTsConfig: true,
    });
  }

  return cachedProject;
};

export const getSourceFileOrThrow = (project: Project, relativePath: string): SourceFile => {
  const absolutePath = pathFromRepoRoot(relativePath);
  const sourceFile = project.getSourceFile(absolutePath) ?? project.addSourceFileAtPathIfExists(absolutePath);
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

const isCallPath = (callExpression: CallExpression, expectedPath: string[]): boolean => {
  const actualPath = getExpressionPath(callExpression.getExpression());
  return actualPath.length === expectedPath.length && actualPath.every((segment, index) => segment === expectedPath[index]);
};

const getStringLiteralValue = (value: Expression | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  return Node.isStringLiteral(value) || Node.isNoSubstitutionTemplateLiteral(value)
    ? value.getLiteralText()
    : undefined;
};

const getIdentifierDeclarationValue = (declaration: VariableDeclaration | undefined): string | undefined =>
  getStringLiteralValue(declaration?.getInitializer());

const getIdentifierLiteralValue = (initializer: Expression): string | undefined => {
  if (!Node.isIdentifier(initializer)) {
    return undefined;
  }

  const declaration = initializer.getDefinitions()[0]?.getDeclarationNode();
  return declaration && Node.isVariableDeclaration(declaration)
    ? getIdentifierDeclarationValue(declaration)
    : undefined;
};

const getPropertyAccessLiteralValue = (initializer: Expression): string | undefined => {
  if (!Node.isPropertyAccessExpression(initializer)) {
    return undefined;
  }

  const symbol = initializer.getNameNode().getSymbol() ?? initializer.getSymbol();
  const declaration = symbol?.getDeclarations()[0];
  return declaration && Node.isPropertyAssignment(declaration)
    ? getStringLiteralValue(declaration.getInitializer())
    : undefined;
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
  return getStringLiteralValue(initializer)
    ?? (initializer ? getIdentifierLiteralValue(initializer) : undefined)
    ?? (initializer ? getPropertyAccessLiteralValue(initializer) : undefined);
};

export const getReferencePaths = (identifier: Identifier): string[] => {
  const paths = new Set<string>();
  for (const referenceNode of identifier.findReferencesAsNodes()) {
    paths.add(toRelativeSourcePath(referenceNode.getSourceFile()));
  }

  return [...paths].sort((left, right) => left.localeCompare(right));
};
