import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { flattenPropertyAccess } from "../_shared/ast-helpers.js";

import { FORBIDDEN_IMPORT_PREFIXES } from "./config.js";
import { getDeclarationTargetPath } from "./project-access.js";

export function sourceHasPrimitiveScrollCall(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => {
    if (Node.isCallExpression(node)) {
      return flattenPropertyAccess(node.getExpression()).join(".").endsWith("primitivePort.scroll");
    }
    if (!Node.isElementAccessExpression(node)) {
      return false;
    }
    const argument = node.getArgumentExpression();
    return argument !== undefined
      && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))
      && argument.getLiteralText() === "scroll";
  });
}

export function sourceHasDynamicImport(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword);
}

export function sourceHasRequire(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "require";
  });
}

export function sourceHasForbiddenImport(sourceFile: SourceFile): boolean {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const targetPath = getDeclarationTargetPath(declaration);
    return targetPath !== null && FORBIDDEN_IMPORT_PREFIXES.some((prefix) => targetPath.startsWith(prefix));
  });
}

export function sourceHasExportStar(sourceFile: SourceFile): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.isNamespaceExport() || declaration.getText().startsWith("export *"));
}

export function sourceHasNewDateOutsideClock(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => Node.isNewExpression(node) ? node.getExpression().getText() === "Date" : Node.isPropertyAccessExpression(node) && node.getText() === "Date.parse");
}