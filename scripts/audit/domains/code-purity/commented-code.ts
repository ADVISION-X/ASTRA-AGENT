import { ts, type SourceFile } from "ts-morph";

import { repoPath } from "./module-graph.js";
import { purityFinding, type PurityFinding, type PurityInput } from "./types.js";

type ParsedCommentSource = ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] };

const executableKinds = new Set([
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.ExportAssignment,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.ReturnStatement,
  ts.SyntaxKind.ThrowStatement,
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.SwitchStatement,
  ts.SyntaxKind.TryStatement,
]);

const uncomment = (text: string): string => {
  const withoutOuter = text.startsWith("/*")
    ? text.slice(2, text.endsWith("*/") ? -2 : undefined)
    : text;
  return withoutOuter.split("\n").map((line) => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("//")) return trimmed.slice(2).trimStart();
    if (trimmed.startsWith("*")) return trimmed.slice(1).trimStart();
    return trimmed;
  }).join("\n").trim();
};

const commentRanges = (source: SourceFile): Array<{ line: number; text: string }> => {
  const seen = new Set<string>();
  const ranges: Array<{ line: number; text: string }> = [];
  source.forEachDescendant((node) => {
    for (const range of [...node.getLeadingCommentRanges(), ...node.getTrailingCommentRanges()]) {
      const key = `${range.getPos()}:${range.getEnd()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ranges.push({ line: source.getLineAndColumnAtPos(range.getPos()).line, text: range.getText() });
    }
  });
  return ranges;
};

const executableExpression = (statement: ts.Statement): boolean => ts.isExpressionStatement(statement) && [
  ts.SyntaxKind.CallExpression,
  ts.SyntaxKind.AwaitExpression,
  ts.SyntaxKind.NewExpression,
  ts.SyntaxKind.BinaryExpression,
].includes(statement.expression.kind);

const looksExecutable = (text: string): boolean => {
  if (!text) return false;
  const parsed = ts.createSourceFile("commented-code.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS) as ParsedCommentSource;
  if ((parsed.parseDiagnostics?.length ?? 0) > 0) return false;
  return parsed.statements.some((statement) => executableKinds.has(statement.kind) || executableExpression(statement));
};

export function inspectCommentedCode(input: PurityInput): PurityFinding[] {
  return input.sourceFiles.flatMap((source) => {
    const path = repoPath(input.root, source.getFilePath());
    return commentRanges(source).flatMap((range) => {
      const text = uncomment(range.text);
      return looksExecutable(text) ? [purityFinding("CODE_PURITY_COMMENTED_OUT_CODE", path, range.line, text.slice(0, 120))] : [];
    });
  });
}
