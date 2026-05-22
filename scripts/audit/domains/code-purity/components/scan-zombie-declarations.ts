import { Node, SyntaxKind, type Identifier, type Node as MorphNode, type SourceFile, type Statement } from "ts-morph";

import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import { pushZombieFinding } from "./zombie-surface-shared.js";

const isWithinSelfBoundary = (referenceNode: MorphNode, selfBoundary: MorphNode): boolean =>
  referenceNode === selfBoundary
  || referenceNode.getAncestors().some((ancestor) => ancestor === selfBoundary);

const collectIdentifierCounts = (sourceFile: SourceFile): Map<string, number> => {
  const identifierCounts = new Map<string, number>();
  for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const currentCount = identifierCounts.get(identifier.getText()) ?? 0;
    identifierCounts.set(identifier.getText(), currentCount + 1);
  }
  return identifierCounts;
};

const isTypeScriptSource = (sourceFile: SourceFile): boolean => /\.(?:ts|tsx)$/u.test(sourceFile.getBaseName());

const hasLiveSameFileReference = (
  nameNode: Identifier,
  selfBoundary: MorphNode,
  input: {
    identifierCounts: ReadonlyMap<string, number>;
    preferIdentifierFallback: boolean;
  },
): boolean => {
  if (input.preferIdentifierFallback) {
    return (input.identifierCounts.get(nameNode.getText()) ?? 0) > 1;
  }
  try {
    return nameNode.findReferencesAsNodes().some((referenceNode) =>
      referenceNode.getSourceFile() === nameNode.getSourceFile()
      && referenceNode !== nameNode
      && !isWithinSelfBoundary(referenceNode, selfBoundary)
    );
  } catch {
    return (input.identifierCounts.get(nameNode.getText()) ?? 0) > 1;
  }
};

const pushUnusedNamedDeclaration = (
  unusedDeclarations: Array<{ kind: string; name: string }>,
  input: {
    kind: string;
    nameNode: MorphNode | undefined;
    exported: boolean;
    selfBoundary: MorphNode;
    identifierCounts: ReadonlyMap<string, number>;
    preferIdentifierFallback: boolean;
  },
): void => {
  if (!input.nameNode || input.exported || !Node.isIdentifier(input.nameNode)) {
    return;
  }
  if (!hasLiveSameFileReference(input.nameNode, input.selfBoundary, input)) {
    unusedDeclarations.push({ kind: input.kind, name: input.nameNode.getText() });
  }
};

const collectUnusedFunctionDeclaration = (
  statement: Statement,
  identifierCounts: ReadonlyMap<string, number>,
  preferIdentifierFallback: boolean,
  unusedDeclarations: Array<{ kind: string; name: string }>,
): boolean => {
  if (Node.isFunctionDeclaration(statement)) {
    pushUnusedNamedDeclaration(unusedDeclarations, {
      kind: "function",
      nameNode: statement.getNameNode(),
      exported: statement.isExported(),
      identifierCounts,
      preferIdentifierFallback,
      selfBoundary: statement,
    });
    return true;
  }
  return false;
};

const collectUnusedClassLikeDeclaration = (
  statement: Statement,
  identifierCounts: ReadonlyMap<string, number>,
  preferIdentifierFallback: boolean,
  unusedDeclarations: Array<{ kind: string; name: string }>,
): boolean => {
  if (Node.isClassDeclaration(statement)) {
    pushUnusedNamedDeclaration(unusedDeclarations, {
      kind: "class",
      nameNode: statement.getNameNode(),
      exported: statement.isExported(),
      identifierCounts,
      preferIdentifierFallback,
      selfBoundary: statement,
    });
    return true;
  }
  if (Node.isEnumDeclaration(statement)) {
    pushUnusedNamedDeclaration(unusedDeclarations, {
      kind: "enum",
      nameNode: statement.getNameNode(),
      exported: statement.isExported(),
      identifierCounts,
      preferIdentifierFallback,
      selfBoundary: statement,
    });
    return true;
  }
  return false;
};

const collectUnusedTypeDeclaration = (
  statement: Statement,
  identifierCounts: ReadonlyMap<string, number>,
  preferIdentifierFallback: boolean,
  unusedDeclarations: Array<{ kind: string; name: string }>,
): boolean => {
  if (Node.isInterfaceDeclaration(statement)) {
    pushUnusedNamedDeclaration(unusedDeclarations, {
      kind: "interface",
      nameNode: statement.getNameNode(),
      exported: statement.isExported(),
      identifierCounts,
      preferIdentifierFallback,
      selfBoundary: statement,
    });
    return true;
  }
  if (Node.isTypeAliasDeclaration(statement)) {
    pushUnusedNamedDeclaration(unusedDeclarations, {
      kind: "type alias",
      nameNode: statement.getNameNode(),
      exported: statement.isExported(),
      identifierCounts,
      preferIdentifierFallback,
      selfBoundary: statement,
    });
    return true;
  }
  return false;
};

const collectUnusedVariableDeclarations = (
  statement: Statement,
  identifierCounts: ReadonlyMap<string, number>,
  preferIdentifierFallback: boolean,
  unusedDeclarations: Array<{ kind: string; name: string }>,
): void => {
  if (!Node.isVariableStatement(statement) || statement.isExported()) {
    return;
  }
  for (const declaration of statement.getDeclarations()) {
    const nameNode = declaration.getNameNode();
    if (Node.isIdentifier(nameNode) && !hasLiveSameFileReference(nameNode, declaration, {
      identifierCounts,
      preferIdentifierFallback,
    })) {
      unusedDeclarations.push({ kind: "variable", name: nameNode.getText() });
    }
  }
};

const collectUnusedDeclarationsFromStatement = (
  statement: Statement,
  identifierCounts: ReadonlyMap<string, number>,
  preferIdentifierFallback: boolean,
  unusedDeclarations: Array<{ kind: string; name: string }>,
): void => {
  if (collectUnusedFunctionDeclaration(statement, identifierCounts, preferIdentifierFallback, unusedDeclarations)) {
    return;
  }
  if (collectUnusedClassLikeDeclaration(statement, identifierCounts, preferIdentifierFallback, unusedDeclarations)) {
    return;
  }
  if (collectUnusedTypeDeclaration(statement, identifierCounts, preferIdentifierFallback, unusedDeclarations)) {
    return;
  }
  collectUnusedVariableDeclarations(statement, identifierCounts, preferIdentifierFallback, unusedDeclarations);
};

const collectUnusedTopLevelDeclarations = (sourceFile: SourceFile): Array<{ kind: string; name: string }> => {
  const identifierCounts = collectIdentifierCounts(sourceFile);
  const preferIdentifierFallback = !isTypeScriptSource(sourceFile);
  const unusedDeclarations: Array<{ kind: string; name: string }> = [];
  for (const statement of sourceFile.getStatements()) {
    collectUnusedDeclarationsFromStatement(statement, identifierCounts, preferIdentifierFallback, unusedDeclarations);
  }
  return unusedDeclarations;
};

export const scanZombieDeclarations = (
  collector: InventoryFindingCollector,
  governedFiles: readonly GovernedFile[],
  zombieLawId: string,
): void => {
  for (const governedFile of governedFiles) {
    for (const declaration of collectUnusedTopLevelDeclarations(governedFile.sourceFile)) {
      pushZombieFinding(collector, {
        checkId: "code-purity/zombie-top-level-declaration",
        governedFile,
        lawId: zombieLawId,
        reason: `Top-level ${declaration.kind} ${declaration.name} has no live identifier usage in the file.`,
        remediation: "Delete the declaration or reconnect it to a real caller in the same active source file.",
        message: `${governedFile.repoPath} keeps an orphan top-level ${declaration.kind} named ${declaration.name}.`,
      });
    }
  }
};