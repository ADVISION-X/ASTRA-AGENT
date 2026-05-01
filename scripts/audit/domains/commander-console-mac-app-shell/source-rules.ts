import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { hasExportModuleSpecifier } from "../_shared/ast-module-path-queries.js";
import { hasAnyKeyword, hasImportModuleSpecifier, hasPropertyAccessPath } from "../_shared/ast-helpers.js";

import { FORBIDDEN_IMPORT_MARKERS } from "./config.js";

export { hasImportModuleSpecifier, hasPropertyAccessPath };

export function hasForbiddenImport(sourceFile: SourceFile): boolean {
  return FORBIDDEN_IMPORT_MARKERS.some((marker) => hasImportModuleSpecifier(sourceFile, marker) || hasExportModuleSpecifier(sourceFile, marker));
}

export function hasUnsafeEscape(sourceFile: SourceFile): boolean {
  const text = sourceFile.getFullText();
  return hasAnyKeyword(sourceFile)
    || text.includes("as any")
    || text.includes("as unknown as")
    || text.includes("@ts-ignore")
    || text.includes("@ts-expect-error")
    || text.includes("eslint-disable")
    || sourceFile.getExportDeclarations().some((declaration) => declaration.isNamespaceExport());
}

export function hasNamedImport(sourceFile: SourceFile, marker: string, importName: string): boolean {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const specifier = declaration.getModuleSpecifierValue() ?? "";
    if (!specifier.includes(marker)) {
      return false;
    }
    return declaration.getNamedImports().some((namedImport) => namedImport.getName() === importName || namedImport.getAliasNode()?.getText() === importName);
  });
}

export function hasSourceTextFragment(sourceFile: SourceFile, fragment: string): boolean {
  return sourceFile.getFullText().includes(fragment);
}

export function hasStartRequiredBothCondition(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement).some((statement) => {
    const expression = statement.getExpression();
    return Node.isBinaryExpression(expression)
      && expression.getOperatorToken().getKind() === SyntaxKind.BarBarToken
      && isNegatedPath(expression.getLeft(), ["requestedPlatformId"])
      && isNegatedPath(expression.getRight(), ["selectedMapId"]);
  });
}

function isNegatedPath(node: Node, pathParts: string[]): boolean {
  if (!Node.isPrefixUnaryExpression(node) || node.getOperatorToken() !== SyntaxKind.ExclamationToken) {
    return false;
  }
  const parts = flattenPropertyAccess(node.getOperand());
  return parts.length === pathParts.length && parts.every((part, index) => part === pathParts[index]);
}

function flattenPropertyAccess(node: Node | undefined): string[] {
  if (!node) {
    return [];
  }
  if (Node.isPropertyAccessExpression(node)) {
    return [...flattenPropertyAccess(node.getExpression()), node.getName()];
  }
  return Node.isIdentifier(node) ? [node.getText()] : [];
}