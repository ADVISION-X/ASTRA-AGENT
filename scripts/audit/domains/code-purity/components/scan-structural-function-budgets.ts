import { SyntaxKind } from "ts-morph";

import { selectLawId } from "../../../shared/finding-utils.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import {
  classBreaksMemberRedLine,
  collectOwnFunctionDescendants,
  collectFunctionLikes,
  computeCyclomaticComplexity,
  computeMaxNestingDepth,
} from "./structural-metrics.js";

const pushFunctionBudgetFinding = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  lawId: string,
  reason: string,
  message: string,
): void => {
  collector.push(
    {
      checkId: "code-purity/function-budget",
      evidenceMode: "static.ast",
      filePath: governedFile.repoPath,
      lawId,
      owner: governedFile.owner,
      reason,
      remediation: "Physically split the function by validation, policy, execution, and evidence-writing roles.",
      role: governedFile.role,
      verificationCommand: "npm run quality:check -- READY",
    },
    message,
  );
};

const collectFunctionBudgetReasons = (functionLike: ReturnType<typeof collectFunctionLikes>[number]): string[] => {
  const body = functionLike.getBody();
  if (!body) {
    return [];
  }
  const lineCount = functionLike.getEndLineNumber() - functionLike.getStartLineNumber() + 1;
  const ownDescendants = collectOwnFunctionDescendants(body);
  const returnCount = ownDescendants.filter((node) => node.getKind() === SyntaxKind.ReturnStatement).length;
  const awaitCount = ownDescendants.filter((node) => node.getKind() === SyntaxKind.AwaitExpression).length;
  const nestingDepth = computeMaxNestingDepth(body);
  const complexity = computeCyclomaticComplexity(body);
  return [
    lineCount > 75 ? `physical line count ${lineCount} exceeds red line 75` : null,
    functionLike.getParameters().length > 7 ? `parameter count ${functionLike.getParameters().length} exceeds red line 7` : null,
    returnCount > 8 ? `return branch count ${returnCount} exceeds red line 8` : null,
    awaitCount > 10 ? `await count ${awaitCount} exceeds red line 10` : null,
    nestingDepth > 5 ? `nesting depth ${nestingDepth} exceeds red line 5` : null,
    complexity > 16 ? `cyclomatic complexity ${complexity} exceeds red line 16` : null,
  ].filter((reason): reason is string => reason !== null);
};

const scanFunctionBudgets = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  inventoryLawId: string,
): void => {
  for (const functionLike of collectFunctionLikes(governedFile)) {
    const reasons = collectFunctionBudgetReasons(functionLike);
    if (reasons.length === 0) {
      continue;
    }
    pushFunctionBudgetFinding(
      collector,
      governedFile,
      inventoryLawId,
      `Function near line ${functionLike.getStartLineNumber()} breaks function budget: ${reasons.join("; ")}.`,
      `${governedFile.repoPath} has an over-line function near line ${functionLike.getStartLineNumber()}.`,
    );
  }
};

const scanClassAndObjectBudgets = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  inventoryLawId: string,
): void => {
  for (const classDeclaration of governedFile.sourceFile.getClasses()) {
    const classLimitBreak = classBreaksMemberRedLine(classDeclaration);
    if (!classLimitBreak) {
      continue;
    }
    collector.push(
      {
        checkId: "code-purity/class-budget",
        evidenceMode: "static.ast",
        filePath: governedFile.repoPath,
        lawId: inventoryLawId,
        owner: governedFile.owner,
        reason: `Class ${classDeclaration.getName() ?? "<anonymous>"} ${classLimitBreak.reason}.`,
        remediation: "Split the class into smaller owner-local collaborators or contract objects.",
        role: governedFile.role,
        verificationCommand: "npm run quality:check -- READY",
      },
      `${governedFile.repoPath} has a class that exceeds the object red line.`,
    );
  }

  for (const objectLiteral of governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
    const memberCount = objectLiteral.getProperties().length;
    if (memberCount <= 30) {
      continue;
    }
    collector.push(
      {
        checkId: "code-purity/object-budget",
        evidenceMode: "static.ast",
        filePath: governedFile.repoPath,
        lawId: inventoryLawId,
        owner: governedFile.owner,
        reason: `Object literal near line ${objectLiteral.getStartLineNumber()} has member count ${memberCount} and exceeds red line 30.`,
        remediation: "Split the object into smaller owner-local contract or configuration objects.",
        role: governedFile.role,
        verificationCommand: "npm run quality:check -- READY",
      },
      `${governedFile.repoPath} has an object literal that exceeds the object red line.`,
    );
  }
};

export const scanStructuralFunctionBudgets = (
  governedFile: GovernedFile,
  lawIds: readonly string[],
  collector: InventoryFindingCollector,
): void => {
  const inventoryLawId = selectLawId(lawIds, "LAW-CODE-PURITY-001-V6");
  scanFunctionBudgets(collector, governedFile, inventoryLawId);
  scanClassAndObjectBudgets(collector, governedFile, inventoryLawId);
};
