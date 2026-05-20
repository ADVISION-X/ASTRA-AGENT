import { Node, SyntaxKind, type Node as MorphNode, type SourceFile } from "ts-morph";

import { FORBIDDEN_ACTIVE_PATTERNS_HARD } from "./forbidden-surfaces.js";
import { toRelativeSourcePath } from "./scope.js";
import type { PurityFinding } from "./types.js";

const ESCAPE_TEXTS = ["mock", "fake", "placeholder", "compat", "fallback", "noop", "no-op"];

const retiredNodeText = (node: MorphNode): string | undefined => {
  if (Node.isIdentifier(node)) return node.getText();
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralText();
  return undefined;
};

const isStructuralFieldIdentifier = (node: MorphNode): boolean => {
  if (!Node.isIdentifier(node)) return false;
  const parent = node.getParent();
  if (!parent) return false;
  return Node.isPropertySignature(parent)
    || Node.isPropertyDeclaration(parent)
    || Node.isPropertyAssignment(parent)
    || Node.isShorthandPropertyAssignment(parent)
    || (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === node)
    || Node.isImportSpecifier(parent)
    || Node.isExportSpecifier(parent);
};

const escapeNodeText = (node: MorphNode): string | undefined => {
  if (!Node.isIdentifier(node)) return undefined;
  if (isStructuralFieldIdentifier(node)) return undefined;
  return node.getText();
};

const isActualSuppressionDirective = (text: string): boolean =>
  text.split("\n").some((line) => {
    const stripped = line.replace(/^\s*\/\//, "").replace(/^\s*\/\*/, "").trim();
    return stripped.startsWith("@ts-ignore")
      || (stripped.startsWith("@ts-expect-error") && !stripped.includes("reviewed"))
      || stripped.startsWith("eslint-disable");
  });

const invalidTodoLine = (text: string): string | undefined =>
  text.split("\n")
    .map((line) => line.replace(/^\s*\/\//, "").replace(/^\s*\/\*/, "").trim())
    .find((line) =>
      line.includes("TODO")
      && !/TODO\(owner=[^)]+,\s*removeBy=[^)]+,\s*reason=[^)]+\)/.test(line)
    );

const isUnmanagedDynamicImport = (node: MorphNode): boolean => {
  if (!Node.isCallExpression(node)) return false;
  if (node.getExpression().getKind() !== SyntaxKind.ImportKeyword) return false;
  const [specifier] = node.getArguments();
  if (!specifier) return true;
  if (specifier.getText().includes("pathToFileURL(pathFromRepoRoot(manifest.entry)).href")) {
    return false;
  }
  return !Node.isStringLiteral(specifier)
    && !Node.isNoSubstitutionTemplateLiteral(specifier);
};

const collectCommentEscapes = (sourceFile: SourceFile): PurityFinding[] => {
  const findings: PurityFinding[] = [];
  const file = toRelativeSourcePath(sourceFile);
  const seen = new Set<number>();
  const seenTodo = new Set<number>();
  sourceFile.forEachDescendant((node) => {
    const fullStart = node.getFullStart();
    if (seenTodo.has(fullStart)) return;
    seenTodo.add(fullStart);
    if (seen.has(fullStart)) return;
    seen.add(fullStart);
    const start = node.getStart();
    if (start <= fullStart) return;
    const trivia = sourceFile.getFullText().slice(fullStart, start);
    if (!isActualSuppressionDirective(trivia)) return;
    findings.push({
      rule: "CP-AST-002",
      file,
      line: sourceFile.getLineAndColumnAtPos(fullStart).line,
      message: "suppression directive escape is forbidden",
    });
  });
  sourceFile.forEachDescendant((node) => {
    const fullStart = node.getFullStart();
    const start = node.getStart();
    if (start <= fullStart) return;
    const trivia = sourceFile.getFullText().slice(fullStart, start);
    const todo = invalidTodoLine(trivia);
    if (!todo) return;
    findings.push({
      rule: "CP-AST-014",
      file,
      line: sourceFile.getLineAndColumnAtPos(fullStart).line,
      message: `invalid TODO format is forbidden: ${todo}`,
    });
  });
  return findings;
};

const collectTypeEscapes = (sourceFile: SourceFile): PurityFinding[] => {
  const findings: PurityFinding[] = [];
  const file = toRelativeSourcePath(sourceFile);
  sourceFile.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.AnyKeyword) {
      findings.push({ rule: "CP-AST-001", file, line: node.getStartLineNumber(), message: "any type escape is forbidden" });
      return;
    }
    if (Node.isAsExpression(node)) {
      const innerExpression = node.getExpression();
      if (!Node.isAsExpression(innerExpression)) return;
      const innerType = innerExpression.getTypeNode();
      if (innerType?.getKind() === SyntaxKind.UnknownKeyword) {
        findings.push({ rule: "CP-AST-007", file, line: node.getStartLineNumber(), message: "as unknown as laundering is forbidden" });
      }
    }
  });
  return findings;
};

const collectRuntimeEscapes = (sourceFile: SourceFile): PurityFinding[] => {
  const findings: PurityFinding[] = [];
  const file = toRelativeSourcePath(sourceFile);
  sourceFile.forEachDescendant((node) => {
    if (Node.isCallExpression(node) && Node.isIdentifier(node.getExpression()) && node.getExpression().getText() === "require") {
      findings.push({ rule: "CP-AST-007", file, line: node.getStartLineNumber(), message: "require() escape is forbidden" });
    }
    if (isUnmanagedDynamicImport(node)) {
      findings.push({ rule: "CP-AST-007", file, line: node.getStartLineNumber(), message: "unmanaged dynamic import escape is forbidden" });
    }
    if (Node.isExportDeclaration(node) && node.getText().startsWith("export *")) {
      findings.push({ rule: "CP-AST-007", file, line: node.getStartLineNumber(), message: "export * escape is forbidden" });
    }
  });
  return findings;
};

const collectTokenEscapes = (sourceFile: SourceFile): PurityFinding[] => {
  const findings: PurityFinding[] = [];
  const file = toRelativeSourcePath(sourceFile);
  sourceFile.forEachDescendant((node) => {
    const escapeText = escapeNodeText(node);
    const retiredText = retiredNodeText(node);
    const escape = escapeText
      ? ESCAPE_TEXTS.find((entry) => escapeText.toLowerCase().includes(entry))
      : undefined;
    const retired = retiredText
      ? FORBIDDEN_ACTIVE_PATTERNS_HARD.find((entry) => retiredText.includes(entry))
      : undefined;
    if (escape) findings.push({ rule: "CP-AST-010", file, line: node.getStartLineNumber(), message: `fake/compat/fallback token is active: ${escape}` });
    if (retired) findings.push({ rule: "CP-AST-006", file, line: node.getStartLineNumber(), message: `retired surface token is active: ${retired}` });
  });
  return findings;
};

export const collectAntiEscapeFindings = (sourceFiles: SourceFile[]): PurityFinding[] => [
  ...sourceFiles.flatMap(collectCommentEscapes),
  ...sourceFiles.flatMap(collectTypeEscapes),
  ...sourceFiles.flatMap(collectRuntimeEscapes),
  ...sourceFiles.flatMap(collectTokenEscapes),
];
