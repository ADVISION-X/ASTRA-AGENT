import { Node, SyntaxKind, type Block, type Node as MorphNode, type ReturnStatement, type ThrowStatement } from "ts-morph";

import { resolveCallsInSourceFile } from "./ast-call-resolver.js";

const failureReturnPattern = /\b(?:ok\s*:\s*false|terminal\s*:\s*true|status\s*:\s*["'](?:failed|review_required|skipped)["'])/u;
const failureCallPattern = /\b(?:buildFailure|stopFacebookMiningRound|reviewRequired|failed|terminal|skip)\b/u;

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
  const text = expression.getText();
  return failureReturnPattern.test(text) || failureCallPattern.test(text);
};

export const isPotentialFailureThrow = (_statement: ThrowStatement): boolean => true;

export const nearestBlock = (node: MorphNode): Block | null => {
  const block = node.getFirstAncestorByKind(SyntaxKind.Block);
  return Node.isBlock(block) ? block : null;
};
