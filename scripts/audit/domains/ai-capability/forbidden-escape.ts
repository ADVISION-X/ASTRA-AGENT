import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { hasAnyKeyword } from "../_shared/ast-helpers.js";

const TS_IGNORE_MARK = `@ts-${"ignore"}`;
const TS_EXPECT_ERROR_MARK = `@ts-${"expect-error"}`;
const ESLINT_DISABLE_MARK = `eslint-${"disable"}`;

const hasAnyEscape = (sourceFile: SourceFile): boolean => {
  if (hasAnyKeyword(sourceFile)) {
    return true;
  }

  return sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).some((expression) => {
    const text = expression.getTypeNode()?.getText() ?? "";
    const inner = expression.getExpression();
    return text === "any"
      || (Node.isAsExpression(inner) && inner.getTypeNode()?.getText() === "unknown");
  });
};

const hasJsonParseEscape = (sourceFile: SourceFile): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).some((expression) => {
    const inner = expression.getExpression();
    return Node.isCallExpression(inner) && inner.getExpression().getText() === "JSON.parse";
  });

const hasSuppressionComment = (node: Node): boolean => {
  const commentText = [
    ...node.getLeadingCommentRanges(),
    ...node.getTrailingCommentRanges(),
  ].map((comment) => comment.getText()).join("\n");
  return commentText.includes(TS_IGNORE_MARK)
    || commentText.includes(TS_EXPECT_ERROR_MARK)
    || commentText.includes(ESLINT_DISABLE_MARK);
};

export function hasForbiddenEscape(sourceFile: SourceFile): boolean {
  return hasAnyEscape(sourceFile)
    || hasJsonParseEscape(sourceFile)
    || sourceFile.getDescendants().some((node) => hasSuppressionComment(node));
}