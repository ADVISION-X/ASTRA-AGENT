import path from "node:path";
import { existsSync } from "node:fs";

import { type SourceFile } from "ts-morph";

import { hasSpecifierFakePathToken, isProductionFakePath } from "./purity-path-rules.js";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".jsonc"] as const;

const normalizeRelativePath = (value: string): string => {
  const normalized = value.replace(/\\/g, "/");
  return normalized.startsWith("./") ? normalized.slice(2) : normalized;
};

const stripRuntimeExtension = (value: string): string =>
  value.replace(/\.(?:js|jsx|mjs)$/u, "");

const firstExistingRelativePath = (relativePaths: string[]): string[] => {
  const existingPath = relativePaths.find((relativePath) => existsSync(path.join(process.cwd(), relativePath)));
  return existingPath ? [existingPath] : [];
};

const buildCandidateRelativePaths = (sourceFile: SourceFile, specifier: string): string[] => {
  if (!specifier.startsWith(".") && !specifier.startsWith("src/") && !specifier.startsWith("scripts/")) {
    return [];
  }

  const sourceRelativePath = normalizeRelativePath(path.relative(process.cwd(), sourceFile.getFilePath()));
  const sourceDirectory = path.posix.dirname(sourceRelativePath);
  const basePath = normalizeRelativePath(
    specifier.startsWith(".")
      ? path.posix.normalize(path.posix.join(sourceDirectory, specifier))
      : specifier,
  );
  const extension = path.posix.extname(basePath);
  if (SOURCE_EXTENSIONS.includes(extension as (typeof SOURCE_EXTENSIONS)[number])) {
    return firstExistingRelativePath([basePath, ...SOURCE_EXTENSIONS.map((candidateExtension) => `${stripRuntimeExtension(basePath)}${candidateExtension}`)]);
  }

  return firstExistingRelativePath([
    ...SOURCE_EXTENSIONS.map((candidateExtension) => `${basePath}${candidateExtension}`),
    ...SOURCE_EXTENSIONS.map((candidateExtension) => `${basePath}/index${candidateExtension}`),
  ]);
};

export const getImportedSourcePaths = (sourceFile: SourceFile): string[] => {
  const paths = new Set<string>();
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    for (const importedPath of buildCandidateRelativePaths(sourceFile, importDeclaration.getModuleSpecifierValue())) {
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
