import { Node, SyntaxKind, type Node as MorphNode, type PropertyAccessExpression, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const normalizeAuditTruthPath = (repoPath: string): string => {
  if (repoPath.startsWith("scripts/")) {
    return repoPath;
  }
  const markerIndex = repoPath.indexOf("/scripts/");
  return markerIndex >= 0 ? repoPath.slice(markerIndex + 1) : repoPath;
};

const isOwnerInspectorFile = (sourceFile: SourceFile): boolean =>
  /^scripts\/audit\/domains\/[^/]+\/inspector\.ts$/u.test(normalizeAuditTruthPath(getRepoSourcePath(sourceFile)));

const isAuditTruthScopeFile = (sourceFile: SourceFile): boolean => {
  const repoPath = normalizeAuditTruthPath(getRepoSourcePath(sourceFile));
  return repoPath.startsWith("scripts/audit/domains/") || repoPath.startsWith("scripts/audit/shared/");
};

const isTrackedSourceTextAccess = (expression: PropertyAccessExpression): boolean => {
  if (expression.getName() !== "getText" && expression.getName() !== "getFullText") {
    return false;
  }
  return expression.getExpression().getType().getSymbol()?.getName() !== "CommentRange";
};

const findForbiddenTextVariableNames = (sourceFile: SourceFile): Set<string> => {
  const variableNames = new Set<string>();
  for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const initializer = declaration.getInitializer();
    if (!initializer || !Node.isCallExpression(initializer)) {
      continue;
    }
    const expression = initializer.getExpression();
    if (Node.isPropertyAccessExpression(expression) && isTrackedSourceTextAccess(expression)) {
      variableNames.add(declaration.getName());
    }
  }
  return variableNames;
};

const hasProjectUsage = (sourceFile: SourceFile): boolean =>
  sourceFile
    .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((expression) => expression.getText() === "context.project");

const isSearchMethod = (name: string): boolean => ["includes", "match", "search", "test"].includes(name);

const receiverUsesTrackedSourceText = (receiver: MorphNode): boolean => {
  if (Node.isIdentifier(receiver)) {
    return false;
  }
  if (!Node.isCallExpression(receiver)) {
    return false;
  }
  const receiverExpression = receiver.getExpression();
  return Node.isPropertyAccessExpression(receiverExpression) && isTrackedSourceTextAccess(receiverExpression);
};

const findSourceTextJudgment = (sourceFile: SourceFile): string | undefined => {
  const forbiddenNames = findForbiddenTextVariableNames(sourceFile);
  const matchedCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || !isSearchMethod(expression.getName())) {
      return false;
    }
    const receiver = expression.getExpression();
    if (Node.isIdentifier(receiver)) {
      return forbiddenNames.has(receiver.getText());
    }
    return receiverUsesTrackedSourceText(receiver);
  });
  return matchedCall?.getText();
};

export const scanAuditNoSourceTextSearch = (input: {
  context: InspectorContext;
  inspectedFiles: Set<string>;
  lawId: string;
}): { findings: InspectorFinding[]; inspectorFileCount: number } => {
  const findings: InspectorFinding[] = [];
  const scopeFiles = input.context.project
    .getSourceFiles()
    .filter((sourceFile) => !sourceFile.isDeclarationFile() && isAuditTruthScopeFile(sourceFile));
  const inspectorFiles = scopeFiles.filter((sourceFile) => isOwnerInspectorFile(sourceFile));

  for (const sourceFile of scopeFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    input.inspectedFiles.add(repoPath);
    if (isOwnerInspectorFile(sourceFile) && !hasProjectUsage(sourceFile)) {
      findings.push(
        createFinding({
          checkId: "audit-truth/inspector-project-usage",
          lawId: input.lawId,
          filePath: repoPath,
          message: `${repoPath} does not use context.project and cannot prove AST-first enforcement.`,
        }),
      );
    }

    const sourceTextJudgment = findSourceTextJudgment(sourceFile);
    if (!sourceTextJudgment) {
      continue;
    }
    findings.push(
      createFinding({
        checkId: "audit-truth/source-text-judgment",
        lawId: input.lawId,
        filePath: repoPath,
        message: `${repoPath} uses source-text judgment ${sourceTextJudgment} on tracked ts-morph text.`,
      }),
    );
  }

  return {
    findings,
    inspectorFileCount: inspectorFiles.length,
  };
};