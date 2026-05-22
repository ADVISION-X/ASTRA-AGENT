import { Node, SyntaxKind, type Expression } from "ts-morph";

import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import { pushZombieFinding } from "./zombie-surface-shared.js";

const resolveLiteralBoolean = (expression: Expression): boolean | undefined => {
  if (Node.isParenthesizedExpression(expression)) {
    return resolveLiteralBoolean(expression.getExpression());
  }
  if (Node.isTrueLiteral(expression)) {
    return true;
  }
  if (Node.isFalseLiteral(expression)) {
    return false;
  }
  if (Node.isPrefixUnaryExpression(expression) && expression.getOperatorToken() === SyntaxKind.ExclamationToken) {
    const operand = resolveLiteralBoolean(expression.getOperand());
    return operand === undefined ? undefined : !operand;
  }
  return undefined;
};

const pushDeadBranchFinding = (
  collector: InventoryFindingCollector,
  input: {
    governedFile: GovernedFile;
    zombieLawId: string;
    lineNumber: number;
    reason: string;
    message: string;
  },
): void => {
  pushZombieFinding(collector, {
    checkId: "code-purity/zombie-dead-branch",
    governedFile: input.governedFile,
    lawId: input.zombieLawId,
    reason: input.reason,
    remediation: "Delete the dead branch or replace the literal gate with lawful runtime state.",
    message: input.message,
  });
};

const scanIfDeadBranches = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  zombieLawId: string,
): void => {
  for (const ifStatement of governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement)) {
    const resolved = resolveLiteralBoolean(ifStatement.getExpression());
    if (resolved === false) {
      const lineNumber = ifStatement.getStartLineNumber();
      pushDeadBranchFinding(collector, {
        governedFile,
        zombieLawId,
        lineNumber,
        reason: `if branch at line ${lineNumber} is guarded by a literal false condition.`,
        message: `${governedFile.repoPath} contains a literal-dead if branch at line ${lineNumber}.`,
      });
    }
    const elseStatement = ifStatement.getElseStatement();
    if (resolved === true && elseStatement) {
      const lineNumber = elseStatement.getStartLineNumber();
      pushDeadBranchFinding(collector, {
        governedFile,
        zombieLawId,
        lineNumber,
        reason: `else branch at line ${lineNumber} is unreachable because the condition is literally true.`,
        message: `${governedFile.repoPath} contains an unreachable else branch at line ${lineNumber}.`,
      });
    }
  }
};

const scanConditionalDeadBranches = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  zombieLawId: string,
): void => {
  for (const conditionalExpression of governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.ConditionalExpression)) {
    const resolved = resolveLiteralBoolean(conditionalExpression.getCondition());
    if (resolved === undefined) {
      continue;
    }
    const lineNumber = resolved
      ? conditionalExpression.getWhenFalse().getStartLineNumber()
      : conditionalExpression.getWhenTrue().getStartLineNumber();
    pushDeadBranchFinding(collector, {
      governedFile,
      zombieLawId,
      lineNumber,
      reason: `ternary branch at line ${lineNumber} is unreachable because the condition is a literal boolean.`,
      message: `${governedFile.repoPath} contains a dead ternary branch at line ${lineNumber}.`,
    });
  }
};

const scanWhileDeadLoops = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  zombieLawId: string,
): void => {
  for (const whileStatement of governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.WhileStatement)) {
    if (resolveLiteralBoolean(whileStatement.getExpression()) !== false) {
      continue;
    }
    const lineNumber = whileStatement.getStartLineNumber();
    pushDeadBranchFinding(collector, {
      governedFile,
      zombieLawId,
      lineNumber,
      reason: `while loop at line ${lineNumber} is guarded by a literal false condition.`,
      message: `${governedFile.repoPath} contains a dead while loop at line ${lineNumber}.`,
    });
  }
};

const scanForDeadLoops = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  zombieLawId: string,
): void => {
  for (const forStatement of governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.ForStatement)) {
    const condition = forStatement.getCondition();
    if (!condition || resolveLiteralBoolean(condition) !== false) {
      continue;
    }
    const lineNumber = forStatement.getStartLineNumber();
    pushDeadBranchFinding(collector, {
      governedFile,
      zombieLawId,
      lineNumber,
      reason: `for loop at line ${lineNumber} is guarded by a literal false condition.`,
      message: `${governedFile.repoPath} contains a dead for loop at line ${lineNumber}.`,
    });
  }
};

export const scanZombieDeadBranches = (
  collector: InventoryFindingCollector,
  governedFiles: readonly GovernedFile[],
  zombieLawId: string,
): void => {
  for (const governedFile of governedFiles) {
    scanIfDeadBranches(collector, governedFile, zombieLawId);
    scanConditionalDeadBranches(collector, governedFile, zombieLawId);
    scanWhileDeadLoops(collector, governedFile, zombieLawId);
    scanForDeadLoops(collector, governedFile, zombieLawId);
  }
};