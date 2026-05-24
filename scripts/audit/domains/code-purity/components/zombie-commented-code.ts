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

const isCommentedExecutableStatement = (statement: ts.Statement, diagnosticsCount: number): boolean => {
  switch (statement.kind) {
    case ts.SyntaxKind.ImportDeclaration:
    case ts.SyntaxKind.ExportDeclaration:
    case ts.SyntaxKind.ExportAssignment:
    case ts.SyntaxKind.FunctionDeclaration:
    case ts.SyntaxKind.ClassDeclaration:
    case ts.SyntaxKind.InterfaceDeclaration:
    case ts.SyntaxKind.TypeAliasDeclaration:
    case ts.SyntaxKind.EnumDeclaration:
    case ts.SyntaxKind.IfStatement:
    case ts.SyntaxKind.ForStatement:
    case ts.SyntaxKind.ForInStatement:
    case ts.SyntaxKind.ForOfStatement:
    case ts.SyntaxKind.WhileStatement:
    case ts.SyntaxKind.DoStatement:
    case ts.SyntaxKind.SwitchStatement:
    case ts.SyntaxKind.TryStatement:
    case ts.SyntaxKind.VariableStatement:
    case ts.SyntaxKind.ReturnStatement:
    case ts.SyntaxKind.ThrowStatement:
      return true;
    case ts.SyntaxKind.ExpressionStatement: {
      if (diagnosticsCount > 0) {
        return false;
      }
      const expression = (statement as ts.ExpressionStatement).expression;
      return expression.kind === ts.SyntaxKind.CallExpression
        || expression.kind === ts.SyntaxKind.AwaitExpression
        || expression.kind === ts.SyntaxKind.NewExpression
        || expression.kind === ts.SyntaxKind.BinaryExpression;
    }
    default:
      return false;
  }
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
    const diagnostics = (parsed as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
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