import { Node, SyntaxKind, type Node as MorphNode, type PropertyAccessExpression, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath, listOwnerInspectorFiles } from "../../../shared/source-files.js";

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

const isSearchMethod = (name: string): boolean => ["includes", "match", "test"].includes(name);

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

const findAntiEvasionCall = (sourceFile: SourceFile): string | undefined => {
  const forbiddenNames = findForbiddenTextVariableNames(sourceFile);
  const matchedCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) {
      return false;
    }
    if (!isSearchMethod(expression.getName())) {
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

export const scanAuditTruth = (context: InspectorContext, lawIds: readonly string[]): InspectorFinding[] => {
  const auditTruthLawId = selectLawId(lawIds, "APEX-CODE-PURITY-013-V1");
  const findings: InspectorFinding[] = [];

  for (const inspectorFile of listOwnerInspectorFiles(context.project)) {
    const repoPath = getRepoSourcePath(inspectorFile);
    if (!hasProjectUsage(inspectorFile)) {
      findings.push(
        createFinding({
          checkId: "code-purity/audit-project-usage",
          lawId: auditTruthLawId,
          filePath: repoPath,
          message: `${repoPath} does not use context.project and cannot prove AST-first enforcement.`,
        }),
      );
    }

    const antiEvasionCall = findAntiEvasionCall(inspectorFile);
    if (antiEvasionCall) {
      findings.push(
        createFinding({
          checkId: "code-purity/audit-anti-evasion",
          lawId: auditTruthLawId,
          filePath: repoPath,
          message: `${repoPath} uses text-search judgment ${antiEvasionCall} on ts-morph source text.`,
        }),
      );
    }
  }

  return findings;
};