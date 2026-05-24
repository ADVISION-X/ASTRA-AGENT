import { Node, SyntaxKind, type Node as MorphNode, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const forbiddenRegexMethodNames = new Set(["exec", "match", "matchAll", "search", "split"]);

const normalizeAuditTruthPath = (repoPath: string): string => {
  if (repoPath.startsWith("scripts/")) {
    return repoPath;
  }
  const markerIndex = repoPath.indexOf("/scripts/");
  return markerIndex >= 0 ? repoPath.slice(markerIndex + 1) : repoPath;
};

const isAuditTruthScopeFile = (sourceFile: SourceFile): boolean => {
  const repoPath = normalizeAuditTruthPath(getRepoSourcePath(sourceFile));
  return repoPath.startsWith("scripts/audit/domains/") || repoPath.startsWith("scripts/audit/shared/");
};

const looksLikeRegExpType = (node: MorphNode): boolean => node.getType().getText().includes("RegExp");

export const scanAuditNoRegex = (input: {
  context: InspectorContext;
  inspectedFiles: Set<string>;
  lawId: string;
}): { findings: InspectorFinding[] } => {
  const findings: InspectorFinding[] = [];
  const scopeFiles = input.context.project
    .getSourceFiles()
    .filter((sourceFile) => !sourceFile.isDeclarationFile() && isAuditTruthScopeFile(sourceFile));

  for (const sourceFile of scopeFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    input.inspectedFiles.add(repoPath);

    const regexLiteral = sourceFile.getDescendantsOfKind(SyntaxKind.RegularExpressionLiteral).at(0);
    if (regexLiteral) {
      findings.push(
        createFinding({
          checkId: "audit-truth/source-regex-judgment",
          evidence: regexLiteral.getText(),
          filePath: repoPath,
          lawId: input.lawId,
          message: `${repoPath} contains a regular expression literal inside audit enforcement scope.`,
        }),
      );
    }

    const regExpConstructor = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).find((expression) => expression.getExpression().getText() === "RegExp")
      ?? sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((expression) => expression.getExpression().getText() === "RegExp");
    if (regExpConstructor) {
      findings.push(
        createFinding({
          checkId: "audit-truth/source-regex-judgment",
          evidence: regExpConstructor.getText(),
          filePath: repoPath,
          lawId: input.lawId,
          message: `${repoPath} constructs RegExp inside audit enforcement scope.`,
        }),
      );
    }

    for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expression = callExpression.getExpression();
      if (!Node.isPropertyAccessExpression(expression)) {
        continue;
      }
      const firstArgument = callExpression.getArguments()[0];
      if (
        forbiddenRegexMethodNames.has(expression.getName())
        && firstArgument
        && (Node.isRegularExpressionLiteral(firstArgument) || looksLikeRegExpType(firstArgument))
      ) {
        findings.push(
          createFinding({
            checkId: "audit-truth/source-regex-judgment",
            evidence: callExpression.getText(),
            filePath: repoPath,
            lawId: input.lawId,
            message: `${repoPath} calls ${expression.getName()} with a regex-shaped argument inside audit enforcement scope.`,
          }),
        );
      }
      if (expression.getName() === "test" && looksLikeRegExpType(expression.getExpression())) {
        findings.push(
          createFinding({
            checkId: "audit-truth/source-regex-judgment",
            evidence: callExpression.getText(),
            filePath: repoPath,
            lawId: input.lawId,
            message: `${repoPath} calls RegExp.test inside audit enforcement scope.`,
          }),
        );
      }
    }
  }

  return { findings };
};