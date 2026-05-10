import { getNodeLine } from "../../../../core/ts-morph.js";
import { Node, type SourceFile } from "ts-morph";

import { isZombieProtectedPath } from "../../../../../../src/audit-support/code-purity/protected-seams.js";
import type { ZombieCandidate, ZombieGraph, ZombieKind } from "./zombie-scan-types.js";

const INSPECTOR_COMPONENT_ROOT = "scripts/audit/domains/";

const isInspectorComponentFile = (relativePath: string): boolean => relativePath.startsWith(INSPECTOR_COMPONENT_ROOT) && relativePath.includes("/components/");

const classifyDeadExportKind = (relativePath: string): ZombieKind => {
  if (isInspectorComponentFile(relativePath)) {
    return "unused-inspector-component";
  }
  if (relativePath.startsWith("src/capabilities/") && relativePath.includes("/children/")) {
    return "unused-child-capability";
  }
  if (
    relativePath === "src/muscle-memory/action-code.ts"
    || relativePath === "src/muscle-memory/catalog.ts"
    || relativePath === "src/muscle-memory/catalog/catalog-seed.ts"
  ) {
    return "unused-muscle-memory-action-code";
  }
  if (relativePath.startsWith("src/map-plugins/builtins/")) {
    return "unused-map-package";
  }
  return "dead-export";
};

type ExportEntry = {
  symbolName: string;
  line: number;
};

const mergeCandidate = (candidates: Map<string, ZombieCandidate>, candidate: ZombieCandidate): void => {
  const key = `${candidate.kind}:${candidate.symbolName}:${candidate.file}`;
  if (!candidates.has(key)) {
    candidates.set(key, candidate);
  }
};

const collectExportEntries = (sourceFile: SourceFile): ExportEntry[] => {
  const entries: ExportEntry[] = [];
  const addEntry = (symbolName: string | undefined, line: number): void => {
    if (symbolName) {
      entries.push({ symbolName, line });
    }
  };

  for (const functionDeclaration of sourceFile.getFunctions()) {
    if (functionDeclaration.isExported()) {
      addEntry(functionDeclaration.getName() ?? undefined, getNodeLine(functionDeclaration));
    }
  }
  for (const classDeclaration of sourceFile.getClasses()) {
    if (classDeclaration.isExported()) {
      addEntry(classDeclaration.getName() ?? undefined, getNodeLine(classDeclaration));
    }
  }
  for (const interfaceDeclaration of sourceFile.getInterfaces()) {
    if (interfaceDeclaration.isExported()) {
      addEntry(interfaceDeclaration.getName() ?? undefined, getNodeLine(interfaceDeclaration));
    }
  }
  for (const typeAliasDeclaration of sourceFile.getTypeAliases()) {
    if (typeAliasDeclaration.isExported()) {
      addEntry(typeAliasDeclaration.getName() ?? undefined, getNodeLine(typeAliasDeclaration));
    }
  }
  for (const enumDeclaration of sourceFile.getEnums()) {
    if (enumDeclaration.isExported()) {
      addEntry(enumDeclaration.getName() ?? undefined, getNodeLine(enumDeclaration));
    }
  }
  for (const variableStatement of sourceFile.getVariableStatements()) {
    if (!variableStatement.hasExportKeyword()) {
      continue;
    }
    for (const declaration of variableStatement.getDeclarations()) {
      addEntry(declaration.getName() || undefined, getNodeLine(declaration));
    }
  }

  return entries;
};

const buildDeadExportCandidate = (relativePath: string, entry: ExportEntry, deadExportKind: ZombieKind): ZombieCandidate => ({
  kind: deadExportKind,
  symbolName: entry.symbolName,
  file: relativePath,
  line: entry.line,
  excludedFiles: [relativePath],
  excludedPathPrefixes: [],
  protectedSeam: null,
  recommendedAction: `Remove ${entry.symbolName} or import it from a lawful caller.`,
});

const buildOrphanCandidate = (relativePath: string): ZombieCandidate => ({
  kind: isInspectorComponentFile(relativePath) ? "unused-inspector-component" : "orphan-file",
  symbolName: relativePath,
  file: relativePath,
  line: 1,
  excludedFiles: [relativePath],
  excludedPathPrefixes: [],
  protectedSeam: null,
  recommendedAction: isInspectorComponentFile(relativePath)
    ? "Delete the unused inspector component or wire it into a lawful inspector runner."
    : "Delete the orphan file or wire it into a lawful import/export path.",
});

const collectLocalExportCandidates = (graph: ZombieGraph, candidates: Map<string, ZombieCandidate>): void => {
  for (const [relativePath, sourceFile] of graph.sourceFilesByPath.entries()) {
    if (isZombieProtectedPath(relativePath)) {
      continue;
    }

    const inboundCallerCount = graph.inboundImportPaths.get(relativePath)?.size ?? 0;
    if (inboundCallerCount > 0) {
      continue;
    }

    const exportedEntries = collectExportEntries(sourceFile);
    const deadExportKind = classifyDeadExportKind(relativePath);
    if (exportedEntries.length === 0) {
      mergeCandidate(candidates, buildOrphanCandidate(relativePath));
      continue;
    }

    for (const entry of exportedEntries) {
      mergeCandidate(candidates, buildDeadExportCandidate(relativePath, entry, deadExportKind));
    }
  }
};

export const collectLocalCodeZombieCandidates = (graph: ZombieGraph, candidates: Map<string, ZombieCandidate>): void => {
  collectLocalExportCandidates(graph, candidates);
};
