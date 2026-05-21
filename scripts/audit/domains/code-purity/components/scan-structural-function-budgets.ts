import { SyntaxKind } from "ts-morph";

import { selectLawId } from "../../../shared/finding-utils.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import {
  classBreaksHardLimit,
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
      filePath: governedFile.repoPath,
      lawId,
      owner: governedFile.owner,
      reason,
      remediation: "Physically split the function by validation, policy, execution, and evidence-writing roles.",
      role: governedFile.role,
      verificationCommand: "npm run ci:full",
    },
    message,
  );
};

export const scanStructuralFunctionBudgets = (
  governedFile: GovernedFile,
  lawIds: readonly string[],
  collector: InventoryFindingCollector,
): void => {
  const inventoryLawId = selectLawId(lawIds, "APEX-CODE-PURITY-015-V1");
  for (const functionLike of collectFunctionLikes(governedFile)) {
    const body = functionLike.getBody();
    if (!body) {
      continue;
    }
    const lineCount = functionLike.getEndLineNumber() - functionLike.getStartLineNumber() + 1;
    const returnCount = body.getDescendantsOfKind(SyntaxKind.ReturnStatement).length;
    const awaitCount = body.getDescendantsOfKind(SyntaxKind.AwaitExpression).length;
    const nestingDepth = computeMaxNestingDepth(body);
    const complexity = computeCyclomaticComplexity(body);
    const reasons = [
      lineCount > 40 ? `physical line count ${lineCount} exceeds hard limit 40` : null,
      functionLike.getParameters().length > 5 ? `parameter count ${functionLike.getParameters().length} exceeds hard limit 5` : null,
      returnCount > 5 ? `return branch count ${returnCount} exceeds hard limit 5` : null,
      awaitCount > 7 ? `await count ${awaitCount} exceeds hard limit 7` : null,
      nestingDepth > 4 ? `nesting depth ${nestingDepth} exceeds hard limit 4` : null,
      complexity > 10 ? `cyclomatic complexity ${complexity} exceeds hard limit 10` : null,
    ].filter((reason): reason is string => reason !== null);
    if (reasons.length === 0) {
      continue;
    }
    pushFunctionBudgetFinding(
      collector,
      governedFile,
      inventoryLawId,
      `Function near line ${functionLike.getStartLineNumber()} breaks function budget: ${reasons.join("; ")}.`,
      `${governedFile.repoPath} has an over-limit function near line ${functionLike.getStartLineNumber()}.`,
    );
  }

  for (const classDeclaration of governedFile.sourceFile.getClasses()) {
    const classLimitBreak = classBreaksHardLimit(classDeclaration);
    if (!classLimitBreak) {
      continue;
    }
    collector.push(
      {
        checkId: "code-purity/class-budget",
        filePath: governedFile.repoPath,
        lawId: inventoryLawId,
        owner: governedFile.owner,
        reason: `Class ${classDeclaration.getName() ?? "<anonymous>"} ${classLimitBreak.reason}.`,
        remediation: "Split the class into smaller owner-local collaborators or contract objects.",
        role: governedFile.role,
        verificationCommand: "npm run ci:full",
      },
      `${governedFile.repoPath} has a class that exceeds the object hard budget.`,
    );
  }
};