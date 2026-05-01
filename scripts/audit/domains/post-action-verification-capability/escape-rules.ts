import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { hasLiteralTextFragment } from "../_shared/ast-literal-queries.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";

import { PATHS } from "./config.js";
import { getRepoPath } from "./project-access.js";

export function isThinAbilityGroup(sourceFile: SourceFile): boolean {
  return hasCallExpressionPath(sourceFile, ["PostActionVerificationAbilityInputSchema", "safeParse"])
    && hasCallExpression(sourceFile, "executePostActionVerification")
    && !hasCallExpression(sourceFile, "createSystemPostActionVerificationClock")
    && !hasLiteralTextFragment(sourceFile, "createInlinePostActionEvidenceReadPort");
}

export function hasForbiddenEscape(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => {
    if (!Node.isAsExpression(node)) {
      return false;
    }
    const typeNode = node.getTypeNode();
    return typeNode?.getText() === "any" || typeNode?.getText() === "never" || node.getText().includes("as unknown as");
  }) || sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword)
    || sourceFile.getImportDeclarations().some((declaration) => declaration.getModuleSpecifierValue() === "require")
    || sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === "require")
    || hasLiteralTextFragment(sourceFile, "@ts-ignore")
    || hasLiteralTextFragment(sourceFile, "@ts-expect-error")
    || hasLiteralTextFragment(sourceFile, "eslint-disable");
}

export function hasDateOutsideClock(sourceFile: SourceFile): boolean {
  if (getRepoPath(sourceFile) === PATHS.CLOCK) {
    return false;
  }
  return sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "Date")
    || sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((expression) => {
      const callee = expression.getExpression();
      return Node.isPropertyAccessExpression(callee)
        && callee.getExpression().getText() === "Date"
        && (callee.getName() === "now" || callee.getName() === "parse");
    });
}

export function leaksPrivatePostActionPath(sourceFile: SourceFile): boolean {
  const repoPath = getRepoPath(sourceFile);
  if (repoPath.startsWith(`${PATHS.ROOT}/`) || repoPath.startsWith("scripts/audit/")) {
    return false;
  }
  return sourceFile.getImportDeclarations().some((declaration) => {
    const specifier = declaration.getModuleSpecifierValue();
    return specifier.includes("/capabilities/post-action-verification/runtime/") || specifier.includes("/capabilities/post-action-verification/children/");
  });
}