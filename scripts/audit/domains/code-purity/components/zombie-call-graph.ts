import { Node, type Identifier, type Node as MorphNode, type Statement } from "ts-morph";

import { toRepoPath } from "../../../shared/paths.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import {
  classifyZombieReferenceUsage,
  isMeaningfulZombieReference,
} from "./zombie-symbol-usage.js";

export type ZombieTopLevelDeclaration = {
  declaration: MorphNode;
  declarationKind: string;
  governedFile: GovernedFile;
  id: string;
  isExported: boolean;
  isRuntimeValue: boolean;
  isTypeOnly: boolean;
  name: string;
  nameNode: Identifier | undefined;
};

export type ZombieDeclarationResolutionFailure = {
  declarationId: string;
  error: string;
  symbolName: string;
};

export type ZombieCallGraph = {
  inboundDeclarationIdsByDeclaration: Map<string, Set<string>>;
  referencedDeclarationIdsByDeclaration: Map<string, Set<string>>;
  rootDeclarationIdsFromTopLevelExecution: Set<string>;
  resolutionFailures: ZombieDeclarationResolutionFailure[];
};

const isWithinBoundary = (referenceNode: MorphNode, boundary: MorphNode): boolean =>
  referenceNode === boundary || referenceNode.getAncestors().some((ancestor) => ancestor === boundary);

const isTopLevelStatement = (statement: Statement): boolean => Node.isSourceFile(statement.getParent());

const isRuntimeTopLevelStatement = (statement: Statement): boolean =>
  isTopLevelStatement(statement)
  && !Node.isImportDeclaration(statement)
  && !Node.isExportDeclaration(statement)
  && !Node.isExportAssignment(statement)
  && !Node.isFunctionDeclaration(statement)
  && !Node.isClassDeclaration(statement)
  && !Node.isEnumDeclaration(statement)
  && !Node.isInterfaceDeclaration(statement)
  && !Node.isTypeAliasDeclaration(statement)
  && !Node.isVariableStatement(statement);

const getTopLevelStatement = (referenceNode: MorphNode): Statement | undefined => {
  for (const ancestor of referenceNode.getAncestors()) {
    if (Node.isStatement(ancestor) && isTopLevelStatement(ancestor)) {
      return ancestor;
    }
  }
  return undefined;
};

const addEdge = (graph: Map<string, Set<string>>, fromId: string, targetId: string): void => {
  const targets = graph.get(fromId);
  if (targets) {
    targets.add(targetId);
    return;
  }
  graph.set(fromId, new Set([targetId]));
};

const addInbound = (graph: Map<string, Set<string>>, targetId: string, fromId: string): void => {
  const sources = graph.get(targetId);
  if (sources) {
    sources.add(fromId);
    return;
  }
  graph.set(targetId, new Set([fromId]));
};

const findContainingDeclaration = (
  declarations: readonly ZombieTopLevelDeclaration[],
  referenceNode: MorphNode,
  targetId: string,
): ZombieTopLevelDeclaration | undefined => {
  const containingDeclarations = declarations.filter(
    (declaration) => declaration.id !== targetId && isWithinBoundary(referenceNode, declaration.declaration),
  );
  return containingDeclarations.sort(
    (left, right) => (left.declaration.getWidth() - right.declaration.getWidth()),
  )[0];
};

const isTopLevelVariableInitializerReference = (
  referenceNode: MorphNode,
  declaration: ZombieTopLevelDeclaration,
): boolean => {
  if (!Node.isVariableDeclaration(declaration.declaration)) {
    return false;
  }
  const initializer = declaration.declaration.getInitializer();
  if (!initializer || !isWithinBoundary(referenceNode, initializer)) {
    return false;
  }
  if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer) || Node.isClassExpression(initializer)) {
    return false;
  }
  return !referenceNode.getAncestors().some((ancestor) => {
    if (ancestor === initializer) {
      return false;
    }
    return Node.isArrowFunction(ancestor)
      || Node.isFunctionDeclaration(ancestor)
      || Node.isFunctionExpression(ancestor)
      || Node.isMethodDeclaration(ancestor)
      || Node.isGetAccessorDeclaration(ancestor)
      || Node.isSetAccessorDeclaration(ancestor);
  });
};

export const buildZombieCallGraph = (input: {
  declarations: readonly ZombieTopLevelDeclaration[];
  reachableFiles: ReadonlySet<string>;
}): ZombieCallGraph => {
  const declarationsByFile = buildDeclarationsByFile(input.declarations);

  const referencedDeclarationIdsByDeclaration = new Map<string, Set<string>>();
  const inboundDeclarationIdsByDeclaration = new Map<string, Set<string>>();
  const rootDeclarationIdsFromTopLevelExecution = new Set<string>();
  const resolutionFailures: ZombieDeclarationResolutionFailure[] = [];

  collectDeclarationReferenceEdges({
    declarations: input.declarations,
    declarationsByFile,
    reachableFiles: input.reachableFiles,
    referencedDeclarationIdsByDeclaration,
    inboundDeclarationIdsByDeclaration,
    rootDeclarationIdsFromTopLevelExecution,
    resolutionFailures,
  });

  return {
    inboundDeclarationIdsByDeclaration,
    referencedDeclarationIdsByDeclaration,
    rootDeclarationIdsFromTopLevelExecution,
    resolutionFailures,
  };
};

const buildDeclarationsByFile = (
  declarations: readonly ZombieTopLevelDeclaration[],
): Map<string, ZombieTopLevelDeclaration[]> => {
  const declarationsByFile = new Map<string, ZombieTopLevelDeclaration[]>();
  for (const declaration of declarations) {
    const fileDeclarations = declarationsByFile.get(declaration.governedFile.repoPath);
    if (fileDeclarations) {
      fileDeclarations.push(declaration);
      continue;
    }
    declarationsByFile.set(declaration.governedFile.repoPath, [declaration]);
  }
  return declarationsByFile;
};

const collectDeclarationReferenceEdges = (input: {
  declarations: readonly ZombieTopLevelDeclaration[];
  declarationsByFile: ReadonlyMap<string, readonly ZombieTopLevelDeclaration[]>;
  reachableFiles: ReadonlySet<string>;
  referencedDeclarationIdsByDeclaration: Map<string, Set<string>>;
  inboundDeclarationIdsByDeclaration: Map<string, Set<string>>;
  rootDeclarationIdsFromTopLevelExecution: Set<string>;
  resolutionFailures: ZombieDeclarationResolutionFailure[];
}): void => {
  for (const declaration of input.declarations) {
    if (!declaration.nameNode) {
      continue;
    }
    try {
      for (const referenceNode of declaration.nameNode.findReferencesAsNodes()) {
        if (referenceNode === declaration.nameNode || isWithinBoundary(referenceNode, declaration.declaration)) {
          continue;
        }
        const referenceFilePath = toRepoPath(referenceNode.getSourceFile().getFilePath());
        if (!input.reachableFiles.has(referenceFilePath)) {
          continue;
        }
        if (!isMeaningfulZombieReference(classifyZombieReferenceUsage(referenceNode))) {
          continue;
        }
        const containingDeclaration = findContainingDeclaration(
          input.declarationsByFile.get(referenceFilePath) ?? [],
          referenceNode,
          declaration.id,
        );
        if (containingDeclaration) {
          addEdge(input.referencedDeclarationIdsByDeclaration, containingDeclaration.id, declaration.id);
          addInbound(input.inboundDeclarationIdsByDeclaration, declaration.id, containingDeclaration.id);
          if (isTopLevelVariableInitializerReference(referenceNode, containingDeclaration)) {
            input.rootDeclarationIdsFromTopLevelExecution.add(declaration.id);
          }
          continue;
        }
        const topLevelStatement = getTopLevelStatement(referenceNode);
        if (topLevelStatement && isRuntimeTopLevelStatement(topLevelStatement)) {
          input.rootDeclarationIdsFromTopLevelExecution.add(declaration.id);
        }
      }
    } catch (error) {
      input.resolutionFailures.push({
        declarationId: declaration.id,
        error: error instanceof Error ? error.message : String(error),
        symbolName: declaration.name,
      });
    }
  }
};
