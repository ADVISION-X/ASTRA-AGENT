import { getNodeLine, getReferencePaths } from "../../../core/ts-morph.js";
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

const resolveDeadExportReferences = (candidate: ZombieCandidate, graphSourceFiles: Map<string, SourceFile>): Set<string> => {
  const sourceFile = graphSourceFiles.get(candidate.file);
  if (!sourceFile) {
    return new Set<string>();
  }

  const declarationNodes = [
    ...sourceFile.getFunctions().filter((fn) => fn.isExported() && fn.getName() === candidate.symbolName),
    ...sourceFile.getClasses().filter((klass) => klass.isExported() && klass.getName() === candidate.symbolName),
    ...sourceFile.getInterfaces().filter((iface) => iface.isExported() && iface.getName() === candidate.symbolName),
    ...sourceFile.getTypeAliases().filter((alias) => alias.isExported() && alias.getName() === candidate.symbolName),
    ...sourceFile.getEnums().filter((enumDeclaration) => enumDeclaration.isExported() && enumDeclaration.getName() === candidate.symbolName),
  ];

  for (const variableStatement of sourceFile.getVariableStatements()) {
    if (!variableStatement.hasExportKeyword()) {
      continue;
    }
    const declaration = variableStatement.getDeclarations().find((item) => item.getName() === candidate.symbolName);
    if (declaration) {
      declarationNodes.push(declaration);
    }
  }

  const references = new Set<string>();
  for (const declaration of declarationNodes) {
    const nameNode = Node.isFunctionDeclaration(declaration)
      || Node.isClassDeclaration(declaration)
      || Node.isInterfaceDeclaration(declaration)
      || Node.isTypeAliasDeclaration(declaration)
      || Node.isEnumDeclaration(declaration)
      ? declaration.getNameNode()
      : Node.isVariableDeclaration(declaration)
        ? declaration.getNameNode()
        : null;
    if (!nameNode) {
      continue;
    }
    for (const filePath of getReferencePaths(nameNode as Identifier)) {
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
    const exportedNames = new Set<string>();

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

    for (const functionDeclaration of sourceFile.getFunctions()) {
      if (!functionDeclaration.isExported() || !functionDeclaration.getName()) {
        continue;
      }
      exportedNames.add(functionDeclaration.getName()!);
      addExportCandidate(functionDeclaration.getName()!, getNodeLine(functionDeclaration));
    }

    for (const classDeclaration of sourceFile.getClasses()) {
      if (!classDeclaration.isExported() || !classDeclaration.getName()) {
        continue;
      }
      exportedNames.add(classDeclaration.getName()!);
      addExportCandidate(classDeclaration.getName()!, getNodeLine(classDeclaration));
    }

    for (const interfaceDeclaration of sourceFile.getInterfaces()) {
      if (!interfaceDeclaration.isExported() || !interfaceDeclaration.getName()) {
        continue;
      }
      exportedNames.add(interfaceDeclaration.getName()!);
      addExportCandidate(interfaceDeclaration.getName()!, getNodeLine(interfaceDeclaration));
    }

    for (const typeAliasDeclaration of sourceFile.getTypeAliases()) {
      if (!typeAliasDeclaration.isExported() || !typeAliasDeclaration.getName()) {
        continue;
      }
      exportedNames.add(typeAliasDeclaration.getName()!);
      addExportCandidate(typeAliasDeclaration.getName()!, getNodeLine(typeAliasDeclaration));
    }

    for (const enumDeclaration of sourceFile.getEnums()) {
      if (!enumDeclaration.isExported() || !enumDeclaration.getName()) {
        continue;
      }
      exportedNames.add(enumDeclaration.getName()!);
      addExportCandidate(enumDeclaration.getName()!, getNodeLine(enumDeclaration));
    }

    for (const variableStatement of sourceFile.getVariableStatements()) {
      if (!variableStatement.hasExportKeyword()) {
        continue;
      }
      for (const declaration of variableStatement.getDeclarations()) {
        const name = declaration.getName();
        if (!name) {
          continue;
        }
        exportedNames.add(name);
        addExportCandidate(name, getNodeLine(declaration));
      }
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
