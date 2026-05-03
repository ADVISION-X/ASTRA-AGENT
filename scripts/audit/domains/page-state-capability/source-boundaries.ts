import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { toRepoRelativePath } from "../../core/paths.js";
import { ROOT } from "./constants.js";

const hasLiteralTextFragment = (sourceFile: SourceFile, fragment: string): boolean =>
  sourceFile.getFullText().includes(fragment);

const hasImportModuleSpecifier = (sourceFile: SourceFile, fragment: string): boolean =>
  sourceFile.getImportDeclarations().some((declaration) => declaration.getModuleSpecifierValue().includes(fragment));

const hasExportModuleSpecifier = (sourceFile: SourceFile, fragment: string): boolean =>
  sourceFile.getExportDeclarations().some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes(fragment));

export function hasForbiddenEscape(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => {
    if (!Node.isAsExpression(node)) {
      return false;
    }

    const typeNode = node.getTypeNode();
    return typeNode?.getText() === "any" || node.getText().includes("as unknown as");
  })
    || sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword)
    || sourceFile.getImportDeclarations().some((declaration) => declaration.getModuleSpecifierValue() === "require")
    || sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === "require")
    || hasLiteralTextFragment(sourceFile, "@ts-ignore")
    || hasLiteralTextFragment(sourceFile, "@ts-expect-error")
    || hasLiteralTextFragment(sourceFile, "eslint-disable");
}

export function hasDateOutsideClock(sourceFile: SourceFile): boolean {
  const repoPath = toRepoRelativePath(sourceFile.getFilePath());
  if (repoPath === `${ROOT}/runtime/page-state-clock.ts`) {
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

export function leaksPrivatePageStatePath(sourceFile: SourceFile): boolean {
  const repoPath = toRepoRelativePath(sourceFile.getFilePath());
  if (repoPath.startsWith(`${ROOT}/`) || repoPath.startsWith("scripts/audit/")) {
    return false;
  }

  return sourceFile.getImportDeclarations().some((declaration) => {
    const specifier = declaration.getModuleSpecifierValue();
    return specifier.includes("/capabilities/page-state/runtime/") || specifier.includes("/capabilities/page-state/children/");
  });
}

export function hasForbiddenCapabilityImport(sourceFile: SourceFile): boolean {
  return [
    "capabilities/ai",
    "capabilities/open",
    "capabilities/screenshot",
    "/screenshot/",
    "capabilities/visual-target",
    "capabilities/mouse-click",
    "capabilities/mouse-scroll",
    "capabilities/post-action-verification",
    "capabilities/forensics-persistence",
    "capabilities/orchestration",
    "capabilities/nerve-bus",
    "lib/browser",
  ].some((marker) => hasImportModuleSpecifier(sourceFile, marker) || hasExportModuleSpecifier(sourceFile, marker));
}

export function hasDomBomUsage(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => {
    const text = identifier.getText();
    return text === "document" || text === "window";
  });
}