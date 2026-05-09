import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";

import { pathFromRepoRoot } from "./inspection-core.js";

export const createAuditProject = (): Project => {
  return new Project({
    tsConfigFilePath: pathFromRepoRoot("tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });
};

export const getSourceFileOrThrow = (project: Project, repoRelativePath: string): SourceFile => {
  const sourceFile = project.addSourceFileAtPathIfExists(pathFromRepoRoot(repoRelativePath));
  if (!sourceFile) {
    throw new Error(`Missing source file: ${repoRelativePath}`);
  }

  return sourceFile;
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

const flattenPropertyAccessElement = (node: Node): string[] | null => {
  if (!Node.isElementAccessExpression(node)) {
    return null;
  }

  const argument = node.getArgumentExpression();
  return argument && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))
    ? [...flattenPropertyAccess(node.getExpression()), argument.getLiteralText()]
    : [];
};

export const flattenPropertyAccess = (node: Node | undefined): string[] => {
  if (!node) {
    return [];
  }

  return flattenPropertyAccessMember(node)
    ?? flattenPropertyAccessIdentifier(node)
    ?? flattenPropertyAccessThis(node)
    ?? flattenPropertyAccessElement(node)
    ?? [];
};

export const hasAnyKeyword = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword).length > 0;
};
