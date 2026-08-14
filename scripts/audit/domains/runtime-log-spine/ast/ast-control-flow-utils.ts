import { Node, SyntaxKind, type Block, type CallExpression, type Node as MorphNode, type ReturnStatement, type ThrowStatement } from "ts-morph";

import { astIdentifierName } from "../../../shared/ast-node-identity.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";
import { resolveCallsInSourceFile } from "./ast-call-resolver.js";

const failureStatuses = new Set(["failed", "review_required", "skipped"]);
const failureIdentifiers = new Set(["buildFailure", "reviewRequired", "failed", "terminal", "skip"]);

const authorizedLogKinds = new Set(["runtime-log-emit", "event-factory", "stage-terminal", "recovery-log"]);

const functionNodeFor = (declaration: MorphNode): MorphNode | null => {
  if (Node.isFunctionLikeDeclaration(declaration)) return declaration;
  if (!Node.isVariableDeclaration(declaration)) return null;
  const initializer = declaration.getInitializer();
  return initializer && Node.isFunctionLikeDeclaration(initializer) ? initializer : null;
};

const callHasAuthorizedLog = (call: CallExpression, visited: Set<string>, depth = 0): boolean => {
  if (depth > 8) return false;
  const sourceFile = call.getSourceFile();
  const repoPath = getRepoSourcePath(sourceFile);
  const resolved = resolveCallsInSourceFile(sourceFile, repoPath)
    .find((candidate) => candidate.callStart === call.getStart());
  if (resolved && authorizedLogKinds.has(resolved.kind)) return true;
  const symbol = call.getExpression().getSymbol();
  const target = symbol?.getAliasedSymbol() ?? symbol;
  return (target?.getDeclarations() ?? []).some((declaration) => {
    const functionNode = functionNodeFor(declaration);
    if (!functionNode || functionNode.getSourceFile().isDeclarationFile()) return false;
    const key = `${functionNode.getSourceFile().getFilePath()}:${functionNode.getStart()}`;
    if (visited.has(key)) return false;
    const nextVisited = new Set(visited).add(key);
    return functionNode.getDescendantsOfKind(SyntaxKind.CallExpression)
      .some((nestedCall) => callHasAuthorizedLog(nestedCall, nextVisited, depth + 1));
  });
};

export const nodeHasAuthorizedLogProvenance = (
  node: MorphNode | undefined,
  visited = new Set<string>(),
): boolean => {
  if (!node) return false;
  const identifiers = [
    ...(Node.isIdentifier(node) ? [node] : []),
    ...node.getDescendantsOfKind(SyntaxKind.Identifier),
  ];
  return identifiers.some((identifier) => (identifier.getSymbol()?.getDeclarations() ?? []).some((declaration) => {
    if (!Node.isVariableDeclaration(declaration)) return false;
    const key = `${declaration.getSourceFile().getFilePath()}:${declaration.getStart()}`;
    if (visited.has(key)) return false;
    const initializer = declaration.getInitializer();
    if (!initializer) return false;
    const nextVisited = new Set(visited).add(key);
    return (Node.isCallExpression(initializer) && callHasAuthorizedLog(initializer, nextVisited))
      || nodeHasAuthorizedLogProvenance(initializer, nextVisited);
  }));
};

export const blockHasAuthorizedLogCall = (block: Block, _filePath: string): boolean => {
  const blockStart = block.getStart();
  const blockEnd = block.getEnd();
  return block.getSourceFile().getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getStart() >= blockStart && call.getEnd() <= blockEnd)
    .some((call) => callHasAuthorizedLog(call, new Set()));
};

export const isFailureReturn = (statement: ReturnStatement): boolean => {
  const expression = statement.getExpression();
  if (!expression) return false;
  const objectLiteral = expression.asKind(SyntaxKind.ObjectLiteralExpression);
  if (objectLiteral) {
    const hasFalseOk = objectLiteral.getProperties().some((property) =>
      Node.isPropertyAssignment(property)
      && property.getName() === "ok"
      && property.getInitializer()?.getKind() === SyntaxKind.FalseKeyword);
    const hasTerminalTrue = objectLiteral.getProperties().some((property) =>
      Node.isPropertyAssignment(property)
      && property.getName() === "terminal"
      && property.getInitializer()?.getKind() === SyntaxKind.TrueKeyword);
    const hasFailureStatus = objectLiteral.getProperties().some((property) => {
      if (!Node.isPropertyAssignment(property) || property.getName() !== "status") {
        return false;
      }
      const initializer = property.getInitializer();
      return (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer))
        && failureStatuses.has(initializer.getLiteralValue());
    });
    if (hasFalseOk || hasTerminalTrue || hasFailureStatus) {
      return true;
    }
  }
  return expression.getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => failureIdentifiers.has(astIdentifierName(identifier) ?? ""));
};

export const isPotentialFailureThrow = (_statement: ThrowStatement): boolean => true;

export const nearestBlock = (node: MorphNode): Block | null => {
  const block = node.getFirstAncestorByKind(SyntaxKind.Block);
  return Node.isBlock(block) ? block : null;
};
