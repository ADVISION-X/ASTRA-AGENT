import { ts, type SourceFile } from "ts-morph";

export type ZombieCommentedCodeHit = {
  line: number;
  sourceText: string;
};

const stripLineCommentMarkers = (text: string): string =>
  text
    .split("\n")
    .map((line) => {
      const trimmed = line.trimStart();
      if (!trimmed.startsWith("//")) {
        return line;
      }
      const withoutMarkers = trimmed.slice(2);
      return withoutMarkers.startsWith(" ") ? withoutMarkers.slice(1) : withoutMarkers;
    })
    .join("\n")
    .trim();

const stripBlockCommentMarkers = (text: string): string => {
  let body = text;
  if (body.startsWith("/*")) {
    body = body.slice(2);
  }
  if (body.endsWith("*/")) {
    body = body.slice(0, -2);
  }
  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trimStart();
      if (!trimmed.startsWith("*")) {
        return trimmed;
      }
      const withoutStar = trimmed.slice(1);
      return withoutStar.startsWith(" ") ? withoutStar.slice(1) : withoutStar;
    })
    .join("\n")
    .trim();
};

const normalizeCommentText = (text: string): string =>
  text.startsWith("/*") ? stripBlockCommentMarkers(text) : stripLineCommentMarkers(text);

type ParsedCommentSourceFile = ts.SourceFile & {
  parseDiagnostics?: readonly ts.Diagnostic[];
};

const commentedDeclarationKinds = new Set([
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.ExportAssignment,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.ReturnStatement,
  ts.SyntaxKind.ThrowStatement,
]);

const commentedControlStatementKinds = new Set([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.SwitchStatement,
  ts.SyntaxKind.TryStatement,
]);

const isCommentedDeclarationOrControlStatement = (statement: ts.Statement): boolean => {
  return commentedDeclarationKinds.has(statement.kind)
    || commentedControlStatementKinds.has(statement.kind);
};

const isExecutableCommentExpression = (
  statement: ts.Statement,
  diagnosticsCount: number,
): boolean => {
  if (!ts.isExpressionStatement(statement) || diagnosticsCount > 0) {
    return false;
  }
  const { expression } = statement;
  return expression.kind === ts.SyntaxKind.CallExpression
    || expression.kind === ts.SyntaxKind.AwaitExpression
    || expression.kind === ts.SyntaxKind.NewExpression
    || expression.kind === ts.SyntaxKind.BinaryExpression;
};

const isCommentedExecutableStatement = (statement: ts.Statement, diagnosticsCount: number): boolean => {
  return isCommentedDeclarationOrControlStatement(statement)
    || isExecutableCommentExpression(statement, diagnosticsCount);
};

const collectCommentRanges = (sourceFile: SourceFile): Array<{ line: number; text: string }> => {
  const seenRanges = new Set<string>();
  const commentRanges: Array<{ line: number; text: string }> = [];
  sourceFile.forEachDescendant((node) => {
    for (const range of [...node.getLeadingCommentRanges(), ...node.getTrailingCommentRanges()]) {
      const key = `${range.getPos()}:${range.getEnd()}`;
      if (seenRanges.has(key)) {
        continue;
      }
      seenRanges.add(key);
      commentRanges.push({
        line: sourceFile.getLineAndColumnAtPos(range.getPos()).line,
        text: range.getText(),
      });
    }
  });
  return commentRanges;
};

export const collectZombieCommentedCodeHits = (sourceFile: SourceFile): ZombieCommentedCodeHit[] => {
  const hits: ZombieCommentedCodeHit[] = [];
  for (const commentRange of collectCommentRanges(sourceFile)) {
    const normalized = normalizeCommentText(commentRange.text);
    if (normalized.length === 0) {
      continue;
    }
    const parsed = ts.createSourceFile(
      "commented-code.ts",
      normalized,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const diagnostics = (parsed as ParsedCommentSourceFile).parseDiagnostics ?? [];
    if (parsed.statements.length === 0) {
      continue;
    }
    if (parsed.statements.some((statement) => isCommentedExecutableStatement(statement, diagnostics.length))) {
      hits.push({
        line: commentRange.line,
        sourceText: normalized,
      });
    }
  }
  return hits;
};