import { Node, SyntaxKind, type SourceFile, type Statement } from "ts-morph";

import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import { pushZombieFinding } from "./zombie-surface-shared.js";

const collectIdentifierCounts = (sourceFile: SourceFile): Map<string, number> => {
  const identifierCounts = new Map<string, number>();
  for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const currentCount = identifierCounts.get(identifier.getText()) ?? 0;
    identifierCounts.set(identifier.getText(), currentCount + 1);
  }
  return identifierCounts;
};

const pushUnusedNamedDeclaration = (
  unusedDeclarations: Array<{ kind: string; name: string }>,
  identifierCounts: ReadonlyMap<string, number>,
  input: { kind: string; name: string | undefined; exported: boolean },
): void => {
  if (!input.name || input.exported) {
    return;
  }
  if ((identifierCounts.get(input.name) ?? 0) === 1) {
    unusedDeclarations.push({ kind: input.kind, name: input.name });
  }
};

const collectUnusedFunctionDeclaration = (
  statement: Statement,
  identifierCounts: ReadonlyMap<string, number>,
  unusedDeclarations: Array<{ kind: string; name: string }>,
): boolean => {
  if (Node.isFunctionDeclaration(statement)) {
    pushUnusedNamedDeclaration(unusedDeclarations, identifierCounts, { kind: "function", name: statement.getName(), exported: statement.isExported() });
    return true;
  }
  return false;
};

const collectUnusedClassLikeDeclaration = (
  statement: Statement,
  identifierCounts: ReadonlyMap<string, number>,
  unusedDeclarations: Array<{ kind: string; name: string }>,
): boolean => {
  if (Node.isClassDeclaration(statement)) {
    pushUnusedNamedDeclaration(unusedDeclarations, identifierCounts, { kind: "class", name: statement.getName(), exported: statement.isExported() });
    return true;
  }
  if (Node.isEnumDeclaration(statement)) {
    pushUnusedNamedDeclaration(unusedDeclarations, identifierCounts, { kind: "enum", name: statement.getName(), exported: statement.isExported() });
    return true;
  }
  return false;
};

const collectUnusedTypeDeclaration = (
  statement: Statement,
  identifierCounts: ReadonlyMap<string, number>,
  unusedDeclarations: Array<{ kind: string; name: string }>,
): boolean => {
  if (Node.isInterfaceDeclaration(statement)) {
    pushUnusedNamedDeclaration(unusedDeclarations, identifierCounts, { kind: "interface", name: statement.getName(), exported: statement.isExported() });
    return true;
  }
  if (Node.isTypeAliasDeclaration(statement)) {
    pushUnusedNamedDeclaration(unusedDeclarations, identifierCounts, { kind: "type alias", name: statement.getName(), exported: statement.isExported() });
    return true;
  }
  return false;
};

const collectUnusedVariableDeclarations = (
  statement: Statement,
  identifierCounts: ReadonlyMap<string, number>,
  unusedDeclarations: Array<{ kind: string; name: string }>,
): void => {
  if (!Node.isVariableStatement(statement) || statement.isExported()) {
    return;
  }
  for (const declaration of statement.getDeclarations()) {
    const nameNode = declaration.getNameNode();
    if (Node.isIdentifier(nameNode) && (identifierCounts.get(nameNode.getText()) ?? 0) === 1) {
      unusedDeclarations.push({ kind: "variable", name: nameNode.getText() });
    }
  }
};

const collectUnusedDeclarationsFromStatement = (
  statement: Statement,
  identifierCounts: ReadonlyMap<string, number>,
  unusedDeclarations: Array<{ kind: string; name: string }>,
): void => {
  if (collectUnusedFunctionDeclaration(statement, identifierCounts, unusedDeclarations)) {
    return;
  }
  if (collectUnusedClassLikeDeclaration(statement, identifierCounts, unusedDeclarations)) {
    return;
  }
  if (collectUnusedTypeDeclaration(statement, identifierCounts, unusedDeclarations)) {
    return;
  }
  collectUnusedVariableDeclarations(statement, identifierCounts, unusedDeclarations);
};

const collectUnusedTopLevelDeclarations = (sourceFile: SourceFile): Array<{ kind: string; name: string }> => {
  const identifierCounts = collectIdentifierCounts(sourceFile);
  const unusedDeclarations: Array<{ kind: string; name: string }> = [];
  for (const statement of sourceFile.getStatements()) {
    collectUnusedDeclarationsFromStatement(statement, identifierCounts, unusedDeclarations);
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