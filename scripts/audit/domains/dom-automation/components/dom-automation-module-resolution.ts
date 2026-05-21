import { type ImportDeclaration } from "ts-morph";

import { toRepoRelativePath } from "../../../core/paths.js";

export const resolveModuleTargetPath = (
  importDeclaration: ImportDeclaration,
): string | null => {
  const target = importDeclaration.getModuleSpecifierSourceFile();
  return target ? toRepoRelativePath(target.getFilePath()) : null;
};

export const resolveImportedDeclarationPaths = (
  importDeclaration: ImportDeclaration,
): string[] => {
  const moduleTargetPath = resolveModuleTargetPath(importDeclaration);
  if (!moduleTargetPath) return [];
  const resolved = new Set<string>([moduleTargetPath]);
  const namedImports = importDeclaration.getImportClause()?.getNamedImports() ?? [];
  const targetFile = importDeclaration.getModuleSpecifierSourceFile();
  if (namedImports.length === 0 || !targetFile) return [...resolved];
  for (const namedImport of namedImports) {
    const exportName = namedImport.getNameNode().getText();
    const exported = targetFile.getExportedDeclarations().get(exportName) ?? [];
    for (const declaration of exported) {
      resolved.add(toRepoRelativePath(declaration.getSourceFile().getFilePath()));
    }
  }
  return [...resolved];
};
