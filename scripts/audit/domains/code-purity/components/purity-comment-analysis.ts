import path from "node:path";

import { ts, type SourceFile } from "ts-morph";

import { COMMENT_CODE_KINDS, type CommentToken } from "./purity-constants.js";

const normalizeCommentText = (value: string): string =>
  value
    .replace(/^\/\//, "")
    .replace(/^\/\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      return trimmed.startsWith("*") ? trimmed.slice(1).trim() : trimmed;
    })
    .join("\n")
    .trim();

export const collectCommentTokens = (sourceFile: SourceFile): CommentToken[] => {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, sourceFile.getFullText());
  const comments: CommentToken[] = [];

  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (token !== ts.SyntaxKind.SingleLineCommentTrivia && token !== ts.SyntaxKind.MultiLineCommentTrivia) {
      continue;
    }

    const text = normalizeCommentText(scanner.getTokenText());
    if (text.length === 0) {
      continue;
    }

    comments.push({
      line: sourceFile.getLineAndColumnAtPos(scanner.getTokenPos()).line,
      text,
    });
  }

  return comments;
};

export const isTodoComment = (comment: string): boolean => {
  const upper = comment.toUpperCase();
  return upper.includes("TODO") || upper.includes("FIXME");
};

export const hasTodoHygiene = (comment: string): boolean => {
  const lower = comment.toLowerCase();
  return (
    lower.includes("owner:")
    && lower.includes("reason:")
    && (lower.includes("phase:") || lower.includes("remove when") || lower.includes("removal:") || lower.includes("until "))
  );
};

export const isCommentedOutCode = (comment: string, relativePath: string): boolean => {
  const extension = path.extname(relativePath) === ".tsx" ? ".tsx" : ".ts";
  const probe = ts.createSourceFile(
    `comment-probe${extension}`,
    comment,
    ts.ScriptTarget.Latest,
    true,
    extension === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, comment);
  const codeLikeTokens = new Set([
    ts.SyntaxKind.ConstKeyword,
    ts.SyntaxKind.ExportKeyword,
    ts.SyntaxKind.FunctionKeyword,
    ts.SyntaxKind.IfKeyword,
    ts.SyntaxKind.ImportKeyword,
    ts.SyntaxKind.LetKeyword,
    ts.SyntaxKind.OpenBraceToken,
    ts.SyntaxKind.ReturnKeyword,
    ts.SyntaxKind.SemicolonToken,
    ts.SyntaxKind.VariableDeclaration,
  ]);
  let containsCodeLikeToken = false;

  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (codeLikeTokens.has(token)) {
      containsCodeLikeToken = true;
      break;
    }
  }

  if (!containsCodeLikeToken || probe.statements.length === 0) {
    return false;
  }

  return probe.statements.some((statement) => COMMENT_CODE_KINDS.has(statement.kind));
};