import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

type TokenPattern = {
  label: string;
  tokens: readonly string[];
  requireCompound?: boolean;
};

const tokenPatterns: readonly TokenPattern[] = [
  { label: "legacy", tokens: ["legacy"] },
  { label: "fallback", tokens: ["fallback"] },
  { label: "optional", tokens: ["optional"], requireCompound: true },
  { label: "degrade", tokens: ["degrade"] },
  { label: "compat", tokens: ["compat"] },
  { label: "compatibility", tokens: ["compatibility"] },
  { label: "localFallback", tokens: ["local", "fallback"] },
  { label: "oldFlow", tokens: ["old", "flow"] },
  { label: "lite", tokens: ["lite"] },
  { label: "compact", tokens: ["compact"] },
  { label: "ppt", tokens: ["ppt"] },
  { label: "pptx", tokens: ["pptx"] },
  { label: "deck", tokens: ["deck"] },
  { label: "business-deck", tokens: ["business", "deck"] },
  { label: "deckOutline", tokens: ["deck", "outline"] },
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

export const inspectNoCompatibilityVocabulary = (input: {
  sourceFiles: readonly SourceFile[];
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of input.sourceFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    input.inspectedFiles.add(repoPath);
    const tokenGroups = [
      ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => tokenize(literal.getLiteralValue())),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => tokenize(identifier.getText())),
    ];
    const found = tokenPatterns
      .filter((pattern) => tokenGroups.some((tokens) => matchesPattern(tokens, pattern)))
      .map((pattern) => pattern.label);
    if (found.length === 0) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/no-compatibility-vocabulary",
      lawId: input.lawId,
      filePath: repoPath,
      message: `Deep Research active source contains forbidden compatibility term(s): ${found.join(", ")}.`,
    }));
  }
};