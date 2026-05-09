import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";

import { pathFromRepoRoot } from "../../core/paths.js";

export function createAuditProject(): Project {
  return new Project({
    tsConfigFilePath: pathFromRepoRoot("tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });
}

export function getSourceFileOrThrow(project: Project, repoRelativePath: string): SourceFile {
  const sourceFile = project.addSourceFileAtPathIfExists(pathFromRepoRoot(repoRelativePath));
  if (!sourceFile) {
    throw new Error(`Missing source file: ${repoRelativePath}`);
  }

  return sourceFile;
}

export function hasImportModuleSpecifier(sourceFile: SourceFile, marker: string): boolean {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const specifier = declaration.getModuleSpecifierValue() ?? "";
    return specifier.includes(marker);
  });
}

export function hasCallExpression(node: Node, calleeName: string): boolean {
  return node.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression)
      ? expression.getText() === calleeName
      : Node.isPropertyAccessExpression(expression) && expression.getName() === calleeName;
  });
}

export function hasCallExpressionPath(node: Node, pathParts: string[]): boolean {
  return node.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expressionPath = flattenPropertyAccess(callExpression.getExpression());
    return expressionPath.length === pathParts.length && expressionPath.every((part, index) => part === pathParts[index]);
  });
}

export function hasPropertyAccessPath(node: Node, pathParts: string[]): boolean {
  return node.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => {
    const parts = flattenPropertyAccess(expression);
    return parts.length === pathParts.length && parts.every((part, index) => part === pathParts[index]);
  });
}

const flattenPropertyAccessMember = (node: Node): string[] | null =>
  Node.isPropertyAccessExpression(node)
    ? [...flattenPropertyAccess(node.getExpression()), node.getName()]
    : null;

const flattenPropertyAccessIdentifier = (node: Node): string[] | null =>
  Node.isIdentifier(node) ? [node.getText()] : null;

const flattenPropertyAccessThis = (node: Node): string[] | null =>
  node.getKind() === SyntaxKind.ThisKeyword ? ["this"] : null;

const flattenPropertyAccessElement = (node: Node): string[] | null => {
  if (!Node.isElementAccessExpression(node)) {
    return null;
  }

  const argument = node.getArgumentExpression();
  if (!argument || (!Node.isStringLiteral(argument) && !Node.isNoSubstitutionTemplateLiteral(argument))) {
    return null;
  }

  return [...flattenPropertyAccess(node.getExpression()), argument.getLiteralText()];
};

export function flattenPropertyAccess(node: Node | undefined): string[] {
  if (!node) {
    return [];
  }

  return flattenPropertyAccessMember(node)
    ?? flattenPropertyAccessIdentifier(node)
    ?? flattenPropertyAccessThis(node)
    ?? flattenPropertyAccessElement(node)
    ?? [];
}

export function hasAnyKeyword(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword).length > 0;
}
