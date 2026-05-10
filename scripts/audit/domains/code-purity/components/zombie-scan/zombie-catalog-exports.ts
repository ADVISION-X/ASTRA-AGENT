import { getNodeLine, getReferencePaths } from "../../../../core/ts-morph.js";
import { Node, type Identifier, type SourceFile } from "ts-morph";

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

const mergeCandidate = (candidates: Map<string, ZombieCandidate>, candidate: ZombieCandidate): void => {
  const key = `${candidate.kind}:${candidate.symbolName}:${candidate.file}`;
  if (!candidates.has(key)) {
    candidates.set(key, candidate);
  }
};

const collectDeclarationNodesForSymbol = (sourceFile: SourceFile, symbolName: string): Node[] => {
  const declarations: Node[] = [
    ...sourceFile.getFunctions().filter((declaration) => declaration.isExported() && declaration.getName() === symbolName),
    ...sourceFile.getClasses().filter((declaration) => declaration.isExported() && declaration.getName() === symbolName),
    ...sourceFile.getInterfaces().filter((declaration) => declaration.isExported() && declaration.getName() === symbolName),
    ...sourceFile.getTypeAliases().filter((declaration) => declaration.isExported() && declaration.getName() === symbolName),
    ...sourceFile.getEnums().filter((declaration) => declaration.isExported() && declaration.getName() === symbolName),
  ];

  for (const variableStatement of sourceFile.getVariableStatements()) {
    if (!variableStatement.hasExportKeyword()) {
      continue;
    }
    const declaration = variableStatement.getDeclarations().find((item) => item.getName() === symbolName);
    if (declaration) {
      declarations.push(declaration);
    }
  }
  return declarations;
};

const resolveDeclarationNameNode = (declaration: Node): Identifier | null => {
  if (
    Node.isFunctionDeclaration(declaration)
    || Node.isClassDeclaration(declaration)
    || Node.isInterfaceDeclaration(declaration)
    || Node.isTypeAliasDeclaration(declaration)
    || Node.isEnumDeclaration(declaration)
  ) {
    return declaration.getNameNode() ?? null;
  }
  if (Node.isVariableDeclaration(declaration)) {
    const variableNameNode = declaration.getNameNode();
    return Node.isIdentifier(variableNameNode) ? variableNameNode : null;
  }
  return null;
};

const collectNamedExportCandidates = (sourceFile: SourceFile): Array<{ symbolName: string; line: number }> => {
  const candidates = [
    ...sourceFile.getFunctions().flatMap((declaration) => declaration.isExported() && declaration.getName() ? [{ symbolName: declaration.getName()!, line: getNodeLine(declaration) }] : []),
    ...sourceFile.getClasses().flatMap((declaration) => declaration.isExported() && declaration.getName() ? [{ symbolName: declaration.getName()!, line: getNodeLine(declaration) }] : []),
    ...sourceFile.getInterfaces().flatMap((declaration) => declaration.isExported() && declaration.getName() ? [{ symbolName: declaration.getName()!, line: getNodeLine(declaration) }] : []),
    ...sourceFile.getTypeAliases().flatMap((declaration) => declaration.isExported() && declaration.getName() ? [{ symbolName: declaration.getName()!, line: getNodeLine(declaration) }] : []),
    ...sourceFile.getEnums().flatMap((declaration) => declaration.isExported() && declaration.getName() ? [{ symbolName: declaration.getName()!, line: getNodeLine(declaration) }] : []),
  ];

  for (const variableStatement of sourceFile.getVariableStatements()) {
    if (!variableStatement.hasExportKeyword()) {
      continue;
    }
    for (const declaration of variableStatement.getDeclarations()) {
      if (declaration.getName()) {
        candidates.push({ symbolName: declaration.getName(), line: getNodeLine(declaration) });
      }
    }
  }
  return candidates;
};

const resolveDeadExportReferences = (candidate: ZombieCandidate, graphSourceFiles: Map<string, SourceFile>): Set<string> => {
  const sourceFile = graphSourceFiles.get(candidate.file);
  if (!sourceFile) {
    return new Set<string>();
  }

  const declarationNodes = collectDeclarationNodesForSymbol(sourceFile, candidate.symbolName);
  const references = new Set<string>();
  for (const declaration of declarationNodes) {
    const nameNode = resolveDeclarationNameNode(declaration);
    if (!nameNode) {
      continue;
    }
    for (const filePath of getReferencePaths(nameNode)) {
      references.add(filePath);
    }
  }

  return references;
};

const collectLocalExportCandidates = (graph: ZombieGraph, candidates: Map<string, ZombieCandidate>): void => {
  for (const [relativePath, sourceFile] of graph.sourceFilesByPath.entries()) {
    if (isZombieProtectedPath(relativePath)) {
      continue;
    }

    const deadExportKind = classifyDeadExportKind(relativePath);
    const addExportCandidate = (symbolName: string, line: number): void => {
      mergeCandidate(candidates, {
        kind: deadExportKind,
        symbolName,
        file: relativePath,
        line,
        excludedFiles: [relativePath],
        excludedPathPrefixes: [],
        protectedSeam: null,
        recommendedAction: `Remove ${symbolName} or import it from a lawful caller.`,
      });
    };

    const exportedNames = new Set<string>();
    for (const candidateInfo of collectNamedExportCandidates(sourceFile)) {
      exportedNames.add(candidateInfo.symbolName);
      addExportCandidate(candidateInfo.symbolName, candidateInfo.line);
    }

    if (exportedNames.size > 0) {
      continue;
    }

    const inboundCallers = graph.inboundImportPaths.get(relativePath)?.size ?? 0;
    if (inboundCallers > 0) {
      continue;
    }

    mergeCandidate(candidates, {
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
  }
};

export const collectLocalCodeZombieCandidates = (graph: ZombieGraph, candidates: Map<string, ZombieCandidate>): void => {
  collectLocalExportCandidates(graph, candidates);
};
