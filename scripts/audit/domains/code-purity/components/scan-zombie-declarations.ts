import { Node, type Identifier, type Node as MorphNode, type Statement } from "ts-morph";

import { toRepoPath } from "../../../shared/paths.js";
import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import type { ZombieReachability } from "./zombie-module-graph.js";
import {
  classifyZombieReferenceUsage,
  isMeaningfulZombieReference,
} from "./zombie-symbol-usage.js";
import { pushZombieFinding } from "./zombie-surface-shared.js";

const isWithinSelfBoundary = (referenceNode: MorphNode, selfBoundary: MorphNode): boolean =>
  referenceNode === selfBoundary
  || referenceNode.getAncestors().some((ancestor) => ancestor === selfBoundary);

const hasLiveSameFileReference = (
  nameNode: Identifier,
  selfBoundary: MorphNode,
  reachability: ZombieReachability,
): boolean =>
  nameNode.findReferencesAsNodes().some((referenceNode) => {
    if (referenceNode === nameNode || isWithinSelfBoundary(referenceNode, selfBoundary)) {
      return false;
    }
    if (!reachability.reachableFiles.has(toRepoPath(referenceNode.getSourceFile().getFilePath()))) {
      return false;
    }
    return isMeaningfulZombieReference(classifyZombieReferenceUsage(referenceNode));
  });

const pushOrphanDeclarationFinding = (
  collector: InventoryFindingCollector,
  input: {
    declarationKind: string;
    governedFile: GovernedFile;
    nameNode: MorphNode | undefined;
    selfBoundary: MorphNode;
    zombieLawId: string;
    antiEvasionLawId: string;
    reachability: ZombieReachability;
  },
): number => {
  if (!input.nameNode || !Node.isIdentifier(input.nameNode)) {
    return 0;
  }
  try {
    if (hasLiveSameFileReference(input.nameNode, input.selfBoundary, input.reachability)) {
      return 0;
    }
  } catch (error) {
    pushZombieFinding(collector, {
      checkId: "code-purity/symbol-resolution-unavailable",
      declarationKind: input.declarationKind,
      governedFile: input.governedFile,
      lawId: input.antiEvasionLawId,
      reason: `Symbol references for ${input.nameNode.getText()} could not be resolved: ${error instanceof Error ? error.message : String(error)}`,
      remediation: "Repair symbol resolution for the declaration; identifier-count fallback is forbidden.",
      symbolName: input.nameNode.getText(),
      message: `${input.governedFile.repoPath} could not resolve symbol references for top-level declaration ${input.nameNode.getText()}.`,
    });
    return 0;
  }
  pushZombieFinding(collector, {
    checkId: "code-purity/zombie-top-level-declaration",
    declarationKind: input.declarationKind,
    governedFile: input.governedFile,
    lawId: input.zombieLawId,
    reason: `Top-level ${input.declarationKind} ${input.nameNode.getText()} has no live symbol reference in the reachable graph.`,
    remediation: "Delete the declaration or reconnect it to a real reachable caller in active source.",
    symbolName: input.nameNode.getText(),
    message: `${input.governedFile.repoPath} keeps an orphan top-level ${input.declarationKind} named ${input.nameNode.getText()}.`,
  });
  return 1;
};

const collectUnusedFunctionDeclaration = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  statement: Statement,
  zombieLawId: string,
  antiEvasionLawId: string,
  reachability: ZombieReachability,
): number => {
  if (!Node.isFunctionDeclaration(statement) || statement.isExported()) {
    return 0;
  }
  return pushOrphanDeclarationFinding(collector, {
    antiEvasionLawId,
    declarationKind: "function",
    governedFile,
    nameNode: statement.getNameNode(),
    reachability,
    selfBoundary: statement,
    zombieLawId,
  });
};

const collectUnusedClassLikeDeclaration = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  statement: Statement,
  zombieLawId: string,
  antiEvasionLawId: string,
  reachability: ZombieReachability,
): number => {
  if (Node.isClassDeclaration(statement)) {
    if (statement.isExported()) {
      return 0;
    }
    return pushOrphanDeclarationFinding(collector, {
      antiEvasionLawId,
      declarationKind: "class",
      governedFile,
      nameNode: statement.getNameNode(),
      reachability,
      selfBoundary: statement,
      zombieLawId,
    });
  }
  if (Node.isEnumDeclaration(statement)) {
    if (statement.isExported()) {
      return 0;
    }
    return pushOrphanDeclarationFinding(collector, {
      antiEvasionLawId,
      declarationKind: "enum",
      governedFile,
      nameNode: statement.getNameNode(),
      reachability,
      selfBoundary: statement,
      zombieLawId,
    });
  }
  return 0;
};

const collectUnusedTypeDeclaration = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  statement: Statement,
  zombieLawId: string,
  antiEvasionLawId: string,
  reachability: ZombieReachability,
): number => {
  if (Node.isInterfaceDeclaration(statement)) {
    if (statement.isExported()) {
      return 0;
    }
    return pushOrphanDeclarationFinding(collector, {
      antiEvasionLawId,
      declarationKind: "interface",
      governedFile,
      nameNode: statement.getNameNode(),
      reachability,
      selfBoundary: statement,
      zombieLawId,
    });
  }
  if (Node.isTypeAliasDeclaration(statement)) {
    if (statement.isExported()) {
      return 0;
    }
    return pushOrphanDeclarationFinding(collector, {
      antiEvasionLawId,
      declarationKind: "type-alias",
      governedFile,
      nameNode: statement.getNameNode(),
      reachability,
      selfBoundary: statement,
      zombieLawId,
    });
  }
  return 0;
};

const collectUnusedVariableDeclarations = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  statement: Statement,
  zombieLawId: string,
  antiEvasionLawId: string,
  reachability: ZombieReachability,
): number => {
  if (!Node.isVariableStatement(statement) || statement.isExported()) {
    return 0;
  }
  let orphanCount = 0;
  for (const declaration of statement.getDeclarations()) {
    orphanCount += pushOrphanDeclarationFinding(collector, {
      antiEvasionLawId,
      declarationKind: "variable",
      governedFile,
      nameNode: declaration.getNameNode(),
      reachability,
      selfBoundary: declaration,
      zombieLawId,
    });
  }
  return orphanCount;
};

const collectUnusedDeclarationsFromStatement = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  statement: Statement,
  zombieLawId: string,
  antiEvasionLawId: string,
  reachability: ZombieReachability,
): number =>
  collectUnusedFunctionDeclaration(collector, governedFile, statement, zombieLawId, antiEvasionLawId, reachability)
  + collectUnusedClassLikeDeclaration(collector, governedFile, statement, zombieLawId, antiEvasionLawId, reachability)
  + collectUnusedTypeDeclaration(collector, governedFile, statement, zombieLawId, antiEvasionLawId, reachability)
  + collectUnusedVariableDeclarations(collector, governedFile, statement, zombieLawId, antiEvasionLawId, reachability);

export const scanZombieDeclarations = (
  collector: InventoryFindingCollector,
  governedFiles: readonly GovernedFile[],
  zombieLawId: string,
  antiEvasionLawId: string,
  reachability: ZombieReachability,
): { orphanDeclarationCount: number } => {
  let orphanDeclarationCount = 0;
  for (const governedFile of governedFiles) {
    if (!reachability.reachableFiles.has(governedFile.repoPath)) {
      continue;
    }
    for (const statement of governedFile.sourceFile.getStatements()) {
      orphanDeclarationCount += collectUnusedDeclarationsFromStatement(
        collector,
        governedFile,
        statement,
        zombieLawId,
        antiEvasionLawId,
        reachability,
      );
    }
  }
  return { orphanDeclarationCount };
};
