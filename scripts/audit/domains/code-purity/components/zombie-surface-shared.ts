import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { SourceFile } from "ts-morph";

import { resolveFromRepo, toRepoPath } from "../../../shared/paths.js";
import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";

export type ZombieGraph = {
  inboundByFile: Map<string, Set<string>>;
  importedNamesByFile: Map<string, Set<string>>;
  namespaceImportedFiles: Set<string>;
  packageEntrypoints: Set<string>;
};

const packagePath = "package.json";
const ownerInspectorPathPattern = /^scripts\/audit\/domains\/[^/]+\/inspector\.ts$/u;
const packageScriptEntrypointPattern = /(?:src|scripts)\/[A-Za-z0-9._/-]+\.(?:ts|tsx|js|jsx|mjs)/gu;
const relativeModulePattern = /^\.{1,2}\//u;
const candidateSuffixes = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", "/index.ts", "/index.tsx", "/index.js", "/index.jsx", "/index.mjs"];

export const pushZombieFinding = (
  collector: InventoryFindingCollector,
  input: {
    checkId: string;
    governedFile: GovernedFile;
    lawId: string;
    reason: string;
    remediation: string;
    message: string;
  },
): void => {
  collector.push(
    {
      checkId: input.checkId,
      filePath: input.governedFile.repoPath,
      lawId: input.lawId,
      owner: input.governedFile.owner,
      reason: input.reason,
      remediation: input.remediation,
      role: input.governedFile.role,
      verificationCommand: "npm run ci:full",
    },
    input.message,
  );
};

const readPackageEntrypoints = (): Set<string> => {
  const packageJson = JSON.parse(readFileSync(resolveFromRepo(packagePath), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const entrypoints = new Set<string>();

  for (const command of Object.values(packageJson.scripts ?? {})) {
    const matches = command.match(packageScriptEntrypointPattern) ?? [];
    for (const match of matches) {
      entrypoints.add(match);
    }
  }

  return entrypoints;
};

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

const resolveGraphTargetPath = (
  sourceFile: SourceFile,
  targetFile: SourceFile | undefined,
  moduleSpecifierValue: string,
): string | undefined => targetFile ? toRepoPath(targetFile.getFilePath()) : resolveRelativeTargetPath(sourceFile, moduleSpecifierValue);

const trackTarget = (
  sourcePath: string,
  targetPath: string | undefined,
  governedPathSet: ReadonlySet<string>,
  graph: Omit<ZombieGraph, "packageEntrypoints">,
  exportNames: readonly string[] = [],
): void => {
  if (!targetPath || !governedPathSet.has(targetPath)) {
    return;
  }
  graph.inboundByFile.get(targetPath)?.add(sourcePath);
  for (const exportName of exportNames) {
    graph.importedNamesByFile.get(targetPath)?.add(exportName);
  }
};

const collectImportEdges = (
  governedFile: GovernedFile,
  governedPathSet: ReadonlySet<string>,
  graph: Omit<ZombieGraph, "packageEntrypoints">,
): void => {
  for (const importDeclaration of governedFile.sourceFile.getImportDeclarations()) {
    const targetPath = resolveGraphTargetPath(
      governedFile.sourceFile,
      importDeclaration.getModuleSpecifierSourceFile(),
      importDeclaration.getModuleSpecifierValue(),
    );
    trackTarget(governedFile.repoPath, targetPath, governedPathSet, graph);
    if (importDeclaration.getDefaultImport()) {
      trackTarget(governedFile.repoPath, targetPath, governedPathSet, graph, ["default"]);
    }
    if (importDeclaration.getNamespaceImport() && targetPath && governedPathSet.has(targetPath)) {
      graph.namespaceImportedFiles.add(targetPath);
    }
    for (const namedImport of importDeclaration.getNamedImports()) {
      trackTarget(governedFile.repoPath, targetPath, governedPathSet, graph, [namedImport.getNameNode().getText()]);
    }
  }
};

const collectReExportEdges = (
  governedFile: GovernedFile,
  governedPathSet: ReadonlySet<string>,
  graph: Omit<ZombieGraph, "packageEntrypoints">,
): void => {
  for (const exportDeclaration of governedFile.sourceFile.getExportDeclarations()) {
    const targetPath = resolveGraphTargetPath(
      governedFile.sourceFile,
      exportDeclaration.getModuleSpecifierSourceFile(),
      exportDeclaration.getModuleSpecifierValue() ?? "",
    );
    if (exportDeclaration.getNamedExports().length === 0) {
      trackTarget(governedFile.repoPath, targetPath, governedPathSet, graph);
      if (targetPath && governedPathSet.has(targetPath)) {
        graph.namespaceImportedFiles.add(targetPath);
      }
      continue;
    }
    trackTarget(
      governedFile.repoPath,
      targetPath,
      governedPathSet,
      graph,
      exportDeclaration.getNamedExports().map((namedExport) => namedExport.getNameNode().getText()),
    );
  }
};

export const buildZombieGraph = (governedFiles: readonly GovernedFile[]): ZombieGraph => {
  const graph = {
    inboundByFile: new Map<string, Set<string>>(),
    importedNamesByFile: new Map<string, Set<string>>(),
    namespaceImportedFiles: new Set<string>(),
  };
  const governedPathSet = new Set(governedFiles.map((governedFile) => governedFile.repoPath));

  for (const governedFile of governedFiles) {
    graph.inboundByFile.set(governedFile.repoPath, new Set());
    graph.importedNamesByFile.set(governedFile.repoPath, new Set());
  }

  for (const governedFile of governedFiles) {
    collectImportEdges(governedFile, governedPathSet, graph);
    collectReExportEdges(governedFile, governedPathSet, graph);
  }

  return {
    ...graph,
    packageEntrypoints: readPackageEntrypoints(),
  };
};

export const isLawfulZombieEntrypoint = (governedFile: GovernedFile, graph: ZombieGraph): boolean =>
  graph.packageEntrypoints.has(governedFile.repoPath) || ownerInspectorPathPattern.test(governedFile.repoPath);