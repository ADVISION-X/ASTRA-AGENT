import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { ExportDeclaration, ImportDeclaration, SourceFile } from "ts-morph";

import { toRepoPath } from "./paths.js";

export type SourceModuleTarget = {
  edgeKind: "import" | "re-export";
  namedBindings: string[];
  namespaceImport: boolean;
  targetPath: string;
};

const relativeModulePattern = /^\.{1,2}\//u;
const candidateSuffixes = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", "/index.ts", "/index.tsx", "/index.js", "/index.jsx", "/index.mjs"];

const resolveRelativeTargetPath = (sourceFile: SourceFile, moduleSpecifierValue: string): string | undefined => {
  if (!relativeModulePattern.test(moduleSpecifierValue)) {
    return undefined;
  }
  const candidateBasePath = resolve(dirname(sourceFile.getFilePath()), moduleSpecifierValue);
  for (const suffix of candidateSuffixes) {
    const candidatePath = `${candidateBasePath}${suffix}`;
    if (existsSync(candidatePath)) {
      return toRepoPath(candidatePath);
    }
  }
  return undefined;
};

const resolveModuleTargetPath = (
  sourceFile: SourceFile,
  targetFile: SourceFile | undefined,
  moduleSpecifierValue: string,
): string | undefined => targetFile ? toRepoPath(targetFile.getFilePath()) : resolveRelativeTargetPath(sourceFile, moduleSpecifierValue);

const buildImportTarget = (sourceFile: SourceFile, importDeclaration: ImportDeclaration): SourceModuleTarget | undefined => {
  const targetPath = resolveModuleTargetPath(
    sourceFile,
    importDeclaration.getModuleSpecifierSourceFile(),
    importDeclaration.getModuleSpecifierValue(),
  );
  if (!targetPath) {
    return undefined;
  }
  const namedBindings: string[] = [];
  if (importDeclaration.getDefaultImport()) {
    namedBindings.push("default");
  }
  for (const namedImport of importDeclaration.getNamedImports()) {
    namedBindings.push(namedImport.getNameNode().getText());
  }
  return {
    edgeKind: "import",
    namedBindings,
    namespaceImport: importDeclaration.getNamespaceImport() !== undefined,
    targetPath,
  };
};

const buildReExportTarget = (sourceFile: SourceFile, exportDeclaration: ExportDeclaration): SourceModuleTarget | undefined => {
  const targetPath = resolveModuleTargetPath(
    sourceFile,
    exportDeclaration.getModuleSpecifierSourceFile(),
    exportDeclaration.getModuleSpecifierValue() ?? "",
  );
  if (!targetPath) {
    return undefined;
  }
  return {
    edgeKind: "re-export",
    namedBindings: exportDeclaration.getNamedExports().map((namedExport) => namedExport.getNameNode().getText()),
    namespaceImport: exportDeclaration.getNamedExports().length === 0,
    targetPath,
  };
};

export const collectResolvedModuleTargets = (sourceFile: SourceFile): SourceModuleTarget[] => {
  const targets: SourceModuleTarget[] = [];
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const target = buildImportTarget(sourceFile, importDeclaration);
    if (target) {
      targets.push(target);
    }
  }
  for (const exportDeclaration of sourceFile.getExportDeclarations()) {
    const target = buildReExportTarget(sourceFile, exportDeclaration);
    if (target) {
      targets.push(target);
    }
  }
  return targets;
};