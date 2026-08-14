import { Node, SyntaxKind, type Node as MorphNode, type Project, type Symbol as MorphSymbol } from "ts-morph";

import { createFinding, selectLawId } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { toRepoPath } from "../../../shared/paths.js";

const forbiddenRegexMethodNames = new Set(["exec", "match", "matchAll", "replace", "replaceAll", "search", "split", "test"]);

const isNoRegexScopePath = (repoPath: string): boolean =>
  repoPath.startsWith("scripts/audit/")
  && !repoPath.startsWith("scripts/audit/generated/")
  && (repoPath.endsWith(".ts") || repoPath.endsWith(".js") || repoPath.endsWith(".mjs"));

const looksLikeRegExpType = (node: MorphNode): boolean => {
  const nodeType = node.getType();
  const candidateTypes = nodeType.isUnion() ? nodeType.getUnionTypes() : [nodeType];
  return candidateTypes.some((candidateType) => {
    const symbolName = candidateType.getSymbol()?.getName() ?? candidateType.getAliasSymbol()?.getName();
    return symbolName === "RegExp";
  });
};

const isGlobalRegExpIdentifier = (node: MorphNode | undefined): boolean =>
  Node.isIdentifier(node)
  && node.getSymbol()?.getEscapedName().toString() === "RegExp"
  && (node.getSymbol()?.getDeclarations().every((declaration) =>
    declaration.getSourceFile().isDeclarationFile()) ?? false);

const resolveVariableInitializer = (
  node: MorphNode | undefined,
  seenSymbols: Set<MorphSymbol>,
): MorphNode | undefined => {
  if (!Node.isIdentifier(node)) return undefined;
  const symbol = node.getSymbol();
  if (!symbol || seenSymbols.has(symbol)) return undefined;
  seenSymbols.add(symbol);
  const declaration = symbol.getDeclarations()[0];
  return declaration && Node.isVariableDeclaration(declaration) ? declaration.getInitializer() : undefined;
};

const isRegExpConstructorExpression = (
  node: MorphNode | undefined,
  seenSymbols: Set<MorphSymbol> = new Set<MorphSymbol>(),
): boolean => {
  if (!node) return false;
  if (isGlobalRegExpIdentifier(node)) return true;
  const initializer = resolveVariableInitializer(node, seenSymbols);
  if (initializer && isRegExpConstructorExpression(initializer, seenSymbols)) return true;
  const nodeType = node.getType();
  const candidateTypes = nodeType.isUnion() ? nodeType.getUnionTypes() : [nodeType];
  return candidateTypes.some((candidateType) => {
    const symbolName = candidateType.getSymbol()?.getName() ?? candidateType.getAliasSymbol()?.getName();
    return symbolName === "RegExp" || symbolName === "RegExpConstructor";
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

    const regExpConstructor = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression)
      .find((expression) => isRegExpConstructorExpression(expression.getExpression()))
      ?? sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
        .find((expression) => isRegExpConstructorExpression(expression.getExpression()));
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
      const hasRegexArgument = firstArgument && (Node.isRegularExpressionLiteral(firstArgument) || looksLikeRegExpType(firstArgument));
      if (forbiddenRegexMethodNames.has(expression.getName()) && hasRegexArgument) {
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
