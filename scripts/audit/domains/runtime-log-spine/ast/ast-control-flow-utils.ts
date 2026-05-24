import { Node, SyntaxKind, type Block, type Node as MorphNode, type ReturnStatement, type ThrowStatement } from "ts-morph";

import { resolveCallsInSourceFile } from "./ast-call-resolver.js";

const failureStatuses = new Set(["failed", "review_required", "skipped"]);
const failureIdentifiers = new Set(["buildFailure", "stopFacebookMiningRound", "reviewRequired", "failed", "terminal", "skip"]);

export const blockHasAuthorizedLogCall = (block: Block, filePath: string): boolean => {
  const blockStart = block.getStart();
  const blockEnd = block.getEnd();
  return resolveCallsInSourceFile(block.getSourceFile(), filePath).some((call) => {
    if (!["runtime-log-emit", "event-factory", "stage-terminal", "recovery-log"].includes(call.kind)) return false;
    const node = block.getSourceFile()
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((candidate) => candidate.getStartLineNumber() === call.line && candidate.getExpression().getText() === call.calleeText);
    return node ? node.getStart() >= blockStart && node.getEnd() <= blockEnd : true;
  });
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
    .some((identifier) => failureIdentifiers.has(identifier.getText()));
};

export const isPotentialFailureThrow = (_statement: ThrowStatement): boolean => true;

export const nearestBlock = (node: MorphNode): Block | null => {
  const block = node.getFirstAncestorByKind(SyntaxKind.Block);
  return Node.isBlock(block) ? block : null;
};
