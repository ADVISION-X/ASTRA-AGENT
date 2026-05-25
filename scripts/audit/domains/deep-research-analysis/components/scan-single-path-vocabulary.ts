import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

type TokenPattern = {
  label: string;
  tokens: readonly string[];
  requireCompound?: boolean;
};

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const tokenPatterns: readonly TokenPattern[] = [
  { label: decode("bGVnYWN5"), tokens: [decode("bGVnYWN5")] },
  { label: decode("ZmFsbGJhY2s="), tokens: [decode("ZmFsbGJhY2s=")] },
  { label: decode("ZGVncmFkZQ=="), tokens: [decode("ZGVncmFkZQ==")] },
  { label: decode("Y29tcGF0"), tokens: [decode("Y29tcGF0")] },
  { label: decode("Y29tcGF0aWJpbGl0eQ=="), tokens: [decode("Y29tcGF0aWJpbGl0eQ==")] },
  { label: decode("bG9jYWxGYWxsYmFjaw=="), tokens: [decode("bG9jYWw="), decode("ZmFsbGJhY2s=")] },
  { label: decode("b2xkRmxvdw=="), tokens: [decode("b2xk"), decode("Zmxvdw==")] },
  { label: decode("bGl0ZQ=="), tokens: [decode("bGl0ZQ==")] },
  { label: decode("Y29tcGFjdA=="), tokens: [decode("Y29tcGFjdA==")] },
  { label: decode("cHB0"), tokens: [decode("cHB0")] },
  { label: decode("cHB0eA=="), tokens: [decode("cHB0eA==")] },
  { label: decode("ZGVjaw=="), tokens: [decode("ZGVjaw==")] },
  { label: decode("YnVzaW5lc3MtZGVjaw=="), tokens: [decode("YnVzaW5lc3M="), decode("ZGVjaw==")] },
  { label: decode("ZGVja091dGxpbmU="), tokens: [decode("ZGVjaw=="), decode("b3V0bGluZQ==")] },
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

const matchesPattern = (tokens: readonly string[], pattern: TokenPattern): boolean => {
  if (pattern.tokens.length === 1) {
    const [onlyToken] = pattern.tokens;
    if (onlyToken === undefined || !tokens.includes(onlyToken)) {
      return false;
    }
    if (pattern.requireCompound) {
      return tokens.length > 1;
    }
    return true;
  }
  return hasTokenSequence(tokens, pattern.tokens);
};

const collectTokenGroups = (sourceFile: SourceFile, repoPath: string): string[][] => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => tokenize(literal.getLiteralValue())),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((literal) => tokenize(literal.getLiteralText())),
  tokenize(repoPath),
];

export const inspectSinglePathVocabulary = (input: {
  sourceFiles: readonly SourceFile[];
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of input.sourceFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    input.inspectedFiles.add(repoPath);
    const tokenGroups = collectTokenGroups(sourceFile, repoPath);
    const found = tokenPatterns
      .filter((pattern) => tokenGroups.some((tokens) => matchesPattern(tokens, pattern)))
      .map((pattern) => pattern.label);
    if (found.length === 0) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/single-path-vocabulary",
      lawId: input.lawId,
      filePath: repoPath,
      message: `Deep Research active source contains forbidden dual-path term(s): ${found.join(", ")}.`,
    }));
  }
};