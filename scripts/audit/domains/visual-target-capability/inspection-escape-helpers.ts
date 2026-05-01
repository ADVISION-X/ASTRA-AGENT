import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { flattenPropertyAccess } from "./inspection-ast-helpers.js";
import { ALLOWED_DATE_FILES } from "./inspection-constants.js";

export const getIllegalDateNodes = (sourceFile: SourceFile): Node[] => {
  const illegalCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const path = flattenPropertyAccess(callExpression.getExpression());
    return path.length === 2 && path[0] === "Date" && path[1] === "parse";
  });
  const illegalNewExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).filter((newExpression) => {
    const expression = newExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "Date";
  });
  return [...illegalCalls, ...illegalNewExpressions];
};

export const getUnknownCastEscapes = (sourceFile: SourceFile): Node[] => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).filter((asExpression) => {
    const currentType = asExpression.getTypeNode()?.getText();
    if (currentType === "any") {
      return true;
    }

    const expression = asExpression.getExpression();
    return Node.isAsExpression(expression) && expression.getTypeNode()?.getText() === "unknown";
  });
};

export const getDynamicImportEscapes = (sourceFile: SourceFile): Node[] => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword);
};

export const getRequireEscapes = (sourceFile: SourceFile): Node[] => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "require";
  });
};

export const getCommentEscapeMarkers = (sourceFile: SourceFile): string[] => {
  const text = sourceFile.getFullText();
  return ["@ts-ignore", "@ts-expect-error", "eslint-disable"].filter((marker) => text.includes(marker));
};

export const canUseDateInFile = (relativePath: string): boolean => {
  return ALLOWED_DATE_FILES.has(relativePath);
};