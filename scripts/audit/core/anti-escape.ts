import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { toRepoRelativePath } from "./paths.js";

export type AntiEscapeFinding = {
  file: string;
  line: number;
  message: string;
};

const scanCommentTrivia = (
  sourceFile: SourceFile,
  matcher: (commentText: string) => boolean,
): Array<{ line: number; text: string }> => {
  const results: Array<{ line: number; text: string }> = [];
  const seenTriviaStarts = new Set<number>();
  sourceFile.forEachDescendant((node) => {
    const fullStart = node.getFullStart();
    if (seenTriviaStarts.has(fullStart)) return;
    seenTriviaStarts.add(fullStart);
    const nodeStart = node.getStart();
    if (nodeStart <= fullStart) return;
    const trivia = sourceFile.getFullText().slice(fullStart, nodeStart);
    if (!matcher(trivia)) return;
    results.push({ line: sourceFile.getLineAndColumnAtPos(fullStart).line, text: trivia.trim() });
  });
  return results;
};

const isSuppressionDirective = (triviaText: string): boolean =>
  triviaText.split("\n").some((line) => {
    const stripped = line.replace(/^\s*\/\//, "").replace(/^\s*\/\*/, "").trim();
    const tsIgnore = `@ts-${"ignore"}`;
    const tsExpectError = `@ts-${"expect-error"}`;
    const eslintDisable = `eslint-${"disable"}`;
    return stripped.startsWith(tsIgnore)
      || stripped.startsWith(tsExpectError)
      || stripped.startsWith(eslintDisable);
  });

export const collectSuppressionDirectiveFindings = (sourceFiles: SourceFile[]): AntiEscapeFinding[] => {
  const findings: AntiEscapeFinding[] = [];
  for (const sourceFile of sourceFiles) {
    const filePath = toRepoRelativePath(sourceFile.getFilePath());
    for (const match of scanCommentTrivia(sourceFile, isSuppressionDirective)) {
      findings.push({ file: filePath, line: match.line, message: `suppression directive escape: ${match.text}` });
    }
  }
  return findings;
};

export const collectExportStarFindings = (sourceFiles: SourceFile[]): AntiEscapeFinding[] => {
  const findings: AntiEscapeFinding[] = [];
  for (const sourceFile of sourceFiles) {
    const filePath = toRepoRelativePath(sourceFile.getFilePath());
    for (const exportDeclaration of sourceFile.getExportDeclarations()) {
      if (!exportDeclaration.getText().startsWith("export *")) continue;
      findings.push({
        file: filePath,
        line: exportDeclaration.getStartLineNumber(),
        message: "export * anti-escape is forbidden",
      });
    }
  }
  return findings;
};

export const collectRequireCallFindings = (sourceFiles: SourceFile[]): AntiEscapeFinding[] => {
  const findings: AntiEscapeFinding[] = [];
  for (const sourceFile of sourceFiles) {
    const filePath = toRepoRelativePath(sourceFile.getFilePath());
    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const expression = node.getExpression();
      if (!Node.isIdentifier(expression) || expression.getText() !== "require") return;
      findings.push({ file: filePath, line: node.getStartLineNumber(), message: "require() anti-escape is forbidden" });
    });
  }
  return findings;
};

export const collectDynamicImportFindings = (sourceFiles: SourceFile[]): AntiEscapeFinding[] => {
  const findings: AntiEscapeFinding[] = [];
  for (const sourceFile of sourceFiles) {
    const filePath = toRepoRelativePath(sourceFile.getFilePath());
    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      if (node.getExpression().getKind() !== SyntaxKind.ImportKeyword) return;
      findings.push({ file: filePath, line: node.getStartLineNumber(), message: "dynamic import anti-escape is forbidden" });
    });
  }
  return findings;
};

const isUnknownAsChain = (node: Node): boolean => {
  if (!Node.isAsExpression(node)) return false;
  const expression = node.getExpression();
  const typeNode = Node.isAsExpression(expression) ? expression.getTypeNode() : undefined;
  return Node.isAsExpression(expression)
    && typeNode?.getKind() === SyntaxKind.UnknownKeyword;
};

export const collectUnknownLaunderingFindings = (sourceFiles: SourceFile[]): AntiEscapeFinding[] => {
  const findings: AntiEscapeFinding[] = [];
  for (const sourceFile of sourceFiles) {
    const filePath = toRepoRelativePath(sourceFile.getFilePath());
    sourceFile.forEachDescendant((node) => {
      if (!isUnknownAsChain(node)) return;
      findings.push({
        file: filePath,
        line: node.getStartLineNumber(),
        message: "unknown as double-cast laundering requires schema-backed validation",
      });
    });
  }
  return findings;
};
