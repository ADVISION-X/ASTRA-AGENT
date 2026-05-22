import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { SourceFile } from "ts-morph";

import { resolveFromRepo, toRepoPath } from "../../../shared/paths.js";
import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";

export type ZombieGraph = {
  reachableFiles: Set<string>;
  importedNamesByFile: Map<string, Set<string>>;
  namespaceImportedFiles: Set<string>;
};

type ZombieGraphEdge = {
  importedNames: string[];
  namespaceImport: boolean;
  targetPath: string;
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

const isLawfulZombieEntrypoint = (governedFile: GovernedFile, packageEntrypoints: ReadonlySet<string>): boolean =>
  packageEntrypoints.has(governedFile.repoPath)
  || ownerInspectorPathPattern.test(governedFile.repoPath);

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

const appendGraphEdge = (
  sourcePath: string,
  targetPath: string | undefined,
  governedPathSet: ReadonlySet<string>,
  outboundByFile: Map<string, ZombieGraphEdge[]>,
  input?: {
    importedNames?: readonly string[];
    namespaceImport?: boolean;
  },
): void => {
  if (!targetPath || !governedPathSet.has(targetPath)) {
    return;
  }
  outboundByFile.get(sourcePath)?.push({
    importedNames: [...(input?.importedNames ?? [])],
    namespaceImport: input?.namespaceImport ?? false,
    targetPath,
  });
};

const collectImportEdges = (
  governedFile: GovernedFile,
  governedPathSet: ReadonlySet<string>,
  outboundByFile: Map<string, ZombieGraphEdge[]>,
): void => {
  for (const importDeclaration of governedFile.sourceFile.getImportDeclarations()) {
    const targetPath = resolveGraphTargetPath(
      governedFile.sourceFile,
      importDeclaration.getModuleSpecifierSourceFile(),
      importDeclaration.getModuleSpecifierValue(),
    );
    const importedNames: string[] = [];
    if (importDeclaration.getDefaultImport()) {
      importedNames.push("default");
    }
    for (const namedImport of importDeclaration.getNamedImports()) {
      importedNames.push(namedImport.getNameNode().getText());
    }
    appendGraphEdge(governedFile.repoPath, targetPath, governedPathSet, outboundByFile, {
      importedNames,
      namespaceImport: importDeclaration.getNamespaceImport() !== undefined,
    });
  }
};

const collectReExportEdges = (
  governedFile: GovernedFile,
  governedPathSet: ReadonlySet<string>,
  outboundByFile: Map<string, ZombieGraphEdge[]>,
): void => {
  for (const exportDeclaration of governedFile.sourceFile.getExportDeclarations()) {
    const targetPath = resolveGraphTargetPath(
      governedFile.sourceFile,
      exportDeclaration.getModuleSpecifierSourceFile(),
      exportDeclaration.getModuleSpecifierValue() ?? "",
    );
    if (exportDeclaration.getNamedExports().length === 0) {
      appendGraphEdge(governedFile.repoPath, targetPath, governedPathSet, outboundByFile, {
        namespaceImport: true,
      });
      continue;
    }
    appendGraphEdge(
      governedFile.repoPath,
      targetPath,
      governedPathSet,
      outboundByFile,
      {
        importedNames: exportDeclaration.getNamedExports().map((namedExport) => namedExport.getNameNode().getText()),
      },
    );
  }
};

const buildLiveReferenceEvidence = (
  governedFiles: readonly GovernedFile[],
  outboundByFile: ReadonlyMap<string, ZombieGraphEdge[]>,
  packageEntrypoints: ReadonlySet<string>,
): Omit<ZombieGraph, "reachableFiles"> & { reachableFiles: Set<string> } => {
  const importedNamesByFile = new Map<string, Set<string>>();
  const namespaceImportedFiles = new Set<string>();
  const reachableFiles = new Set<string>();

  for (const governedFile of governedFiles) {
    importedNamesByFile.set(governedFile.repoPath, new Set());
  }

  const pendingPaths = governedFiles
    .filter((governedFile) => isLawfulZombieEntrypoint(governedFile, packageEntrypoints))
    .map((governedFile) => governedFile.repoPath);

  while (pendingPaths.length > 0) {
    const currentPath = pendingPaths.shift();
    if (!currentPath || reachableFiles.has(currentPath)) {
      continue;
    }
    reachableFiles.add(currentPath);
    for (const edge of outboundByFile.get(currentPath) ?? []) {
      if (edge.namespaceImport) {
        namespaceImportedFiles.add(edge.targetPath);
      }
      for (const importedName of edge.importedNames) {
        importedNamesByFile.get(edge.targetPath)?.add(importedName);
      }
      if (!reachableFiles.has(edge.targetPath)) {
        pendingPaths.push(edge.targetPath);
      }
    }
  }

  return {
    importedNamesByFile,
    namespaceImportedFiles,
    reachableFiles,
  };
};

export const buildZombieGraph = (governedFiles: readonly GovernedFile[]): ZombieGraph => {
  const governedPathSet = new Set(governedFiles.map((governedFile) => governedFile.repoPath));
  const outboundByFile = new Map<string, ZombieGraphEdge[]>();

  for (const governedFile of governedFiles) {
    outboundByFile.set(governedFile.repoPath, []);
  }

  for (const governedFile of governedFiles) {
    collectImportEdges(governedFile, governedPathSet, outboundByFile);
    collectReExportEdges(governedFile, governedPathSet, outboundByFile);
  }

  return buildLiveReferenceEvidence(governedFiles, outboundByFile, readPackageEntrypoints());
};

export const isLawfulZombieExport = (governedFile: GovernedFile, exportName: string): boolean =>
  ownerInspectorPathPattern.test(governedFile.repoPath)
  && exportName === "inspectDomain";