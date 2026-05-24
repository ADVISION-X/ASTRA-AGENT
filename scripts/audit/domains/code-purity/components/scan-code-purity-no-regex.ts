import { Node, SyntaxKind, type Node as MorphNode, type Project } from "ts-morph";

import { createFinding, selectLawId } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { toRepoPath } from "../../../shared/paths.js";

const forbiddenRegexMethodNames = new Set(["match", "matchAll", "search"]);

const isNoRegexScopePath = (repoPath: string): boolean =>
  repoPath.startsWith("scripts/audit/domains/code-purity/")
  || repoPath === "scripts/audit/shared/source-module-targets.ts";

const looksLikeRegExpType = (node: MorphNode): boolean => {
  const nodeType = node.getType();
  const candidateTypes = nodeType.isUnion() ? nodeType.getUnionTypes() : [nodeType];
  return candidateTypes.some((candidateType) => {
    const symbolName = candidateType.getSymbol()?.getName() ?? candidateType.getAliasSymbol()?.getName();
    return symbolName === "RegExp";
  });
};

const buildNoRegexFinding = (input: {
  evidence: string;
  filePath: string;
  lawId: string;
  message: string;
}): InspectorFinding =>
  createFinding({
    checkId: "code-purity/no-regex",
    evidence: input.evidence,
    filePath: input.filePath,
    lawId: input.lawId,
    message: input.message,
  });

export const scanCodePurityNoRegex = (project: Project, lawIds: readonly string[]): InspectorFinding[] => {
  const noRegexLawId = selectLawId(lawIds, "APEX-CODE-PURITY-018-V1");
  const findings: InspectorFinding[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const repoPath = toRepoPath(sourceFile.getFilePath());
    if (!isNoRegexScopePath(repoPath)) {
      continue;
    }

    const regexLiteral = sourceFile.getDescendantsOfKind(SyntaxKind.RegularExpressionLiteral).at(0);
    if (regexLiteral) {
      findings.push(
        buildNoRegexFinding({
          evidence: regexLiteral.getText(),
          filePath: repoPath,
          lawId: noRegexLawId,
          message: `${repoPath} contains a regular expression literal in code-purity enforcement scope.`,
        }),
      );
    }

    const regExpConstructor = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).find((expression) => expression.getExpression().getText() === "RegExp")
      ?? sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((expression) => expression.getExpression().getText() === "RegExp");
    if (regExpConstructor) {
      findings.push(
        buildNoRegexFinding({
          evidence: regExpConstructor.getText(),
          filePath: repoPath,
          lawId: noRegexLawId,
          message: `${repoPath} constructs RegExp inside code-purity enforcement scope.`,
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
          buildNoRegexFinding({
            evidence: callExpression.getText(),
            filePath: repoPath,
            lawId: noRegexLawId,
            message: `${repoPath} calls ${expression.getName()} with a regex-shaped argument inside code-purity enforcement scope.`,
          }),
        );
      }
      if (expression.getName() === "test" && looksLikeRegExpType(expression.getExpression())) {
        findings.push(
          buildNoRegexFinding({
            evidence: callExpression.getText(),
            filePath: repoPath,
            lawId: noRegexLawId,
            message: `${repoPath} calls RegExp.test inside code-purity enforcement scope.`,
          }),
        );
      }
    }
  }

  return findings;
};