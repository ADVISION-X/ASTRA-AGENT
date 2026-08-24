import { SyntaxKind } from "ts-morph";

import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import type { ZombieReachability } from "./zombie-module-graph.js";
import { evaluateZombieBooleanExpression } from "./zombie-const-evaluator.js";
import { pushZombieFinding } from "./zombie-surface-shared.js";

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
): number => {
  let deadBranchCount = 0;
  for (const ifStatement of governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement)) {
    const resolved = evaluateZombieBooleanExpression(ifStatement.getExpression());
    if (resolved === false) {
      const lineNumber = ifStatement.getStartLineNumber();
      pushDeadBranchFinding(collector, {
        governedFile,
        zombieLawId,
        lineNumber,
        reason: `if branch at line ${lineNumber} is guarded by a literal false condition.`,
        message: `${governedFile.repoPath} contains a literal-dead if branch at line ${lineNumber}.`,
      });
      deadBranchCount += 1;
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
      deadBranchCount += 1;
    }
  }
  return deadBranchCount;
};

const scanConditionalDeadBranches = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  zombieLawId: string,
): number => {
  let deadBranchCount = 0;
  for (const conditionalExpression of governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.ConditionalExpression)) {
    const resolved = evaluateZombieBooleanExpression(conditionalExpression.getCondition());
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
    deadBranchCount += 1;
  }
  return deadBranchCount;
};

const scanWhileDeadLoops = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  zombieLawId: string,
): number => {
  let deadBranchCount = 0;
  for (const whileStatement of governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.WhileStatement)) {
    if (evaluateZombieBooleanExpression(whileStatement.getExpression()) !== false) {
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
    deadBranchCount += 1;
  }
  return deadBranchCount;
};

const scanForDeadLoops = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  zombieLawId: string,
): number => {
  let deadBranchCount = 0;
  for (const forStatement of governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.ForStatement)) {
    const condition = forStatement.getCondition();
    if (!condition || evaluateZombieBooleanExpression(condition) !== false) {
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
    deadBranchCount += 1;
  }
  return deadBranchCount;
};

export const scanZombieDeadBranches = (
  collector: InventoryFindingCollector,
  governedFiles: readonly GovernedFile[],
  zombieLawId: string,
  reachability: ZombieReachability,
): { deadBranchCount: number } => {
  let deadBranchCount = 0;
  for (const governedFile of governedFiles) {
    if (!reachability.reachableFiles.has(governedFile.repoPath)) {
      continue;
    }
    deadBranchCount += scanIfDeadBranches(collector, governedFile, zombieLawId);
    deadBranchCount += scanConditionalDeadBranches(collector, governedFile, zombieLawId);
    deadBranchCount += scanWhileDeadLoops(collector, governedFile, zombieLawId);
    deadBranchCount += scanForDeadLoops(collector, governedFile, zombieLawId);
  }
  return { deadBranchCount };
};
