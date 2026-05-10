import { SyntaxKind, type SourceFile } from "ts-morph";

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

export function hasTaskStartRequestDelegation(sourceFile: SourceFile): boolean {
  return hasNamedImport(sourceFile, "./task-start-api-handler.js", "handleTaskStartRequest")
    && sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getText() === "handleTaskStartRequest");
}