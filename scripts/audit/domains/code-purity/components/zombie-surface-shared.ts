import { readFileSync } from "node:fs";

import { lawfulDomZombieExportsByFile } from "../../dom-automation/components/dom-lawful-zombie-exports.js";
import { resolveFromRepo, toRepoPath } from "../../../shared/paths.js";
import {
  collectResolvedModuleTargets,
  type SourceModuleTarget,
} from "../../../shared/source-module-targets.js";
import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";

export type ZombieGraph = {
  reachableFiles: Set<string>;
  importedNamesByFile: Map<string, Set<string>>;
  namespaceImportedFiles: Set<string>;
};

const packagePath = "package.json";
const ownerInspectorPathPattern = /^scripts\/audit\/domains\/[^/]+\/inspector\.ts$/u;
const packageScriptEntrypointPattern = /(?:src|scripts)\/[A-Za-z0-9._/-]+\.(?:ts|tsx|js|jsx|mjs)/gu;

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

const appendGraphEdge = (
  sourcePath: string,
  target: SourceModuleTarget,
  governedPathSet: ReadonlySet<string>,
  outboundByFile: Map<string, SourceModuleTarget[]>,
): void => {
  if (!governedPathSet.has(target.targetPath)) {
    return;
  }
  outboundByFile.get(sourcePath)?.push(target);
};

const createImportedNamesByFile = (governedFiles: readonly GovernedFile[]): Map<string, Set<string>> => {
  const importedNamesByFile = new Map<string, Set<string>>();
  for (const governedFile of governedFiles) {
    importedNamesByFile.set(governedFile.repoPath, new Set());
  }
  return importedNamesByFile;
};

const listLawfulEntrypointPaths = (
  governedFiles: readonly GovernedFile[],
  packageEntrypoints: ReadonlySet<string>,
): string[] =>
  governedFiles
    .filter((governedFile) => isLawfulZombieEntrypoint(governedFile, packageEntrypoints))
    .map((governedFile) => governedFile.repoPath);

const recordLiveEdgeEvidence = (
  edge: SourceModuleTarget,
  importedNamesByFile: ReadonlyMap<string, Set<string>>,
  namespaceImportedFiles: Set<string>,
): void => {
  if (edge.namespaceImport) {
    namespaceImportedFiles.add(edge.targetPath);
  }
  for (const importedName of edge.namedBindings) {
    importedNamesByFile.get(edge.targetPath)?.add(importedName);
  }
};

const collectReachableFiles = (
  outboundByFile: ReadonlyMap<string, SourceModuleTarget[]>,
  entrypointPaths: readonly string[],
  importedNamesByFile: ReadonlyMap<string, Set<string>>,
  namespaceImportedFiles: Set<string>,
): Set<string> => {
  const reachableFiles = new Set<string>();
  const pendingPaths = [...entrypointPaths];

  while (pendingPaths.length > 0) {
    const currentPath = pendingPaths.shift();
    if (!currentPath || reachableFiles.has(currentPath)) {
      continue;
    }
    reachableFiles.add(currentPath);
    for (const edge of outboundByFile.get(currentPath) ?? []) {
      recordLiveEdgeEvidence(edge, importedNamesByFile, namespaceImportedFiles);
      if (!reachableFiles.has(edge.targetPath)) {
        pendingPaths.push(edge.targetPath);
      }
    }
  }

  return reachableFiles;
};

const createOutboundByFile = (
  governedFiles: readonly GovernedFile[],
  governedPathSet: ReadonlySet<string>,
): Map<string, SourceModuleTarget[]> => {
  const outboundByFile = new Map<string, SourceModuleTarget[]>();
  for (const governedFile of governedFiles) {
    outboundByFile.set(governedFile.repoPath, []);
  }
  for (const governedFile of governedFiles) {
    for (const target of collectResolvedModuleTargets(governedFile.sourceFile)) {
      appendGraphEdge(governedFile.repoPath, target, governedPathSet, outboundByFile);
    }
  }
  return outboundByFile;
};

export const buildZombieGraph = (governedFiles: readonly GovernedFile[]): ZombieGraph => {
  const governedPathSet = new Set(governedFiles.map((governedFile) => governedFile.repoPath));
  const packageEntrypoints = readPackageEntrypoints();
  const outboundByFile = createOutboundByFile(governedFiles, governedPathSet);
  const importedNamesByFile = createImportedNamesByFile(governedFiles);
  const namespaceImportedFiles = new Set<string>();
  const reachableFiles = collectReachableFiles(
    outboundByFile,
    listLawfulEntrypointPaths(governedFiles, packageEntrypoints),
    importedNamesByFile,
    namespaceImportedFiles,
  );

  return {
    importedNamesByFile,
    namespaceImportedFiles,
    reachableFiles,
  };
};

export const isLawfulZombieExport = (governedFile: GovernedFile, exportName: string): boolean =>
  (ownerInspectorPathPattern.test(governedFile.repoPath)
    && exportName === "inspectDomain")
  || Boolean(lawfulDomZombieExportsByFile[governedFile.repoPath]?.includes(exportName));