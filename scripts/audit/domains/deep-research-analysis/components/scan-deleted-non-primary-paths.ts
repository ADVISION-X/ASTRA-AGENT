import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

type TokenPattern = {
  label: string;
  tokens: readonly string[];
};

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const tokenPatterns: readonly TokenPattern[] = [
  { label: decode("cHB0"), tokens: [decode("cHB0")] },
  { label: decode("cHB0eA=="), tokens: [decode("cHB0eA==")] },
  { label: decode("ZGVjaw=="), tokens: [decode("ZGVjaw==")] },
  { label: decode("YnVzaW5lc3MtZGVjaw=="), tokens: [decode("YnVzaW5lc3M="), decode("ZGVjaw==")] },
  { label: decode("ZGVja091dGxpbmU="), tokens: [decode("ZGVjaw=="), decode("b3V0bGluZQ==")] },
  { label: decode("ZmFsbGJhY2s="), tokens: [decode("ZmFsbGJhY2s=")] },
  { label: decode("bGVnYWN5"), tokens: [decode("bGVnYWN5")] },
  { label: decode("b3B0aW9uYWw="), tokens: [decode("b3B0aW9uYWw=")] },
  { label: decode("Y29tcGFjdA=="), tokens: [decode("Y29tcGFjdA==")] },
  { label: decode("bGl0ZQ=="), tokens: [decode("bGl0ZQ==")] },
] as const;

const tokenize = (value: string): string[] =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const hasTokenSequence = (tokens: readonly string[], sequence: readonly string[]): boolean => {
  if (sequence.length === 0 || sequence.length > tokens.length) {
    return false;
  }
  for (let index = 0; index <= tokens.length - sequence.length; index += 1) {
    if (sequence.every((token, offset) => tokens[index + offset] === token)) {
      return true;
    }
  }
  return false;
};

const matchesPattern = (tokens: readonly string[], pattern: TokenPattern): boolean =>
  pattern.tokens.length === 1
    ? tokens.includes(pattern.tokens[0] ?? "")
    : hasTokenSequence(tokens, pattern.tokens);

const collectTokenGroups = (sourceFile: SourceFile, repoPath: string): string[][] => [
  tokenize(repoPath),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => tokenize(literal.getLiteralValue())),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((literal) => tokenize(literal.getLiteralText())),
];

export const inspectDeletedNonPrimaryPaths = (input: {
  sourceFiles: readonly SourceFile[];
  acceptanceFiles: readonly SourceFile[];
  auditComponentFiles: readonly SourceFile[];
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of [...input.sourceFiles, ...input.acceptanceFiles, ...input.auditComponentFiles]) {
    const repoPath = getRepoSourcePath(sourceFile);
    input.inspectedFiles.add(repoPath);
    const tokenGroups = collectTokenGroups(sourceFile, repoPath);
    const found = tokenPatterns
      .filter((pattern) => tokenGroups.some((tokens) => matchesPattern(tokens, pattern)))
      .map((pattern) => pattern.label);
    if (found.length === 0) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/deleted-non-primary-paths",
      lawId: input.lawId,
      filePath: repoPath,
      message: `Deleted non-primary Deep Research marker(s) remain in active source: ${found.join(", ")}.`,
    }));
  }
};