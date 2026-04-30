import { type ImportDeclaration, type SourceFile } from "ts-morph";

import { toRelativeSourcePath } from "../../../core/ts-morph.js";
import { hasSpecifierFakePathToken, isProductionFakePath } from "./purity-path-rules.js";

const resolveMissingModuleSpecifierSourceFile = (_error: unknown): SourceFile | undefined => undefined;

const getImportDeclarationSourcePaths = (importDeclaration: ImportDeclaration): string[] => {
  const paths = new Set<string>();
  let moduleSpecifierSourceFile: SourceFile | undefined;
  try {
    moduleSpecifierSourceFile = importDeclaration.getModuleSpecifierSourceFile() ?? undefined;
  } catch (error) {
    moduleSpecifierSourceFile = resolveMissingModuleSpecifierSourceFile(error);
  }
  if (moduleSpecifierSourceFile) {
    paths.add(toRelativeSourcePath(moduleSpecifierSourceFile));
  }

  const importNodes = [
    importDeclaration.getDefaultImport(),
    importDeclaration.getNamespaceImport(),
    ...importDeclaration.getNamedImports().map((namedImport) => namedImport.getNameNode()),
  ].filter((node): node is NonNullable<typeof node> => Boolean(node));

  for (const importNode of importNodes) {
    const symbol = importNode.getSymbol();
    const targetSymbol = symbol?.getAliasedSymbol() ?? symbol;
    if (!targetSymbol) {
      continue;
    }

    for (const declaration of targetSymbol.getDeclarations()) {
      paths.add(toRelativeSourcePath(declaration.getSourceFile()));
    }
  }

  return [...paths];
};

export const getImportedSourcePaths = (sourceFile: SourceFile): string[] => {
  const paths = new Set<string>();
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    for (const importedPath of getImportDeclarationSourcePaths(importDeclaration)) {
      paths.add(importedPath);
    }
  }

  return [...paths].sort((left, right) => left.localeCompare(right));
};

export const getImportModuleSpecifiers = (sourceFile: SourceFile): string[] =>
  sourceFile.getImportDeclarations().map((declaration) => declaration.getModuleSpecifierValue());

export const hasProductionFakeImport = (sourceFile: SourceFile): boolean =>
  getImportedSourcePaths(sourceFile).some((importedPath) => isProductionFakePath(importedPath))
  || getImportModuleSpecifiers(sourceFile).some((specifier) => hasSpecifierFakePathToken(specifier));