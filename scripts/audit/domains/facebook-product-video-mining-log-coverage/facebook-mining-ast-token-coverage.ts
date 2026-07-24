import { SyntaxKind, type SourceFile } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

export type AstTokenCoverage = {
  firstLine: number;
  values: ReadonlySet<string>;
};

const sourceTokens = (sourceFile: SourceFile): Array<{ line: number; value: string }> => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => ({
    line: node.getStartLineNumber(),
    value: String(node.compilerNode.escapedText),
  })),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => ({
    line: node.getStartLineNumber(),
    value: node.getLiteralText(),
  })),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => ({
    line: node.getStartLineNumber(),
    value: node.getLiteralText(),
  })),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).map((node) => ({
    line: node.getStartLineNumber(),
    value: node.getName(),
  })),
];

export const collectAstTokenCoverage = (
  context: InspectorContext,
  repoPaths: readonly string[],
): AstTokenCoverage => {
  const tokens = repoPaths.flatMap((repoPath) => {
    const sourceFile = context.project.getSourceFile(resolveFromRepo(repoPath));
    return sourceFile ? sourceTokens(sourceFile) : [];
  });
  return {
    firstLine: tokens[0]?.line ?? 1,
    values: new Set(tokens.map((token) => token.value)),
  };
};

export const hasAstToken = (coverage: AstTokenCoverage, expected: string): boolean =>
  coverage.values.has(expected);

export const hasAstTokenPart = (coverage: AstTokenCoverage, expected: string): boolean => {
  const normalized = expected.toLowerCase();
  return [...coverage.values].some((value) => value.toLowerCase().includes(normalized));
};
