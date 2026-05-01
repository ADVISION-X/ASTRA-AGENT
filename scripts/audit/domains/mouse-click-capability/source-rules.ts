import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { flattenPropertyAccess } from "../_shared/ast-helpers.js";
import { FORBIDDEN_IMPORT_PREFIXES } from "./config.js";

export function sourceHasPrimitiveClickCall(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => {
    if (Node.isCallExpression(node)) {
      const expressionPath = flattenPropertyAccess(node.getExpression()).join(".");
      return expressionPath.endsWith("primitivePort.click");
    }
    if (Node.isElementAccessExpression(node)) {
      const argument = node.getArgumentExpression();
      return argument !== undefined
        && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))
        && argument.getLiteralText() === "click";
    }
    return false;
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
  return sourceFile.getImportDeclarations().some((declaration) => FORBIDDEN_IMPORT_PREFIXES.some((prefix) => declaration.getModuleSpecifierValue().includes(prefix)));
}

export function sourceHasExportStar(sourceFile: SourceFile): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.isNamespaceExport() || declaration.getText().startsWith("export *"));
}

export function sourceHasNewDateOutsideClock(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => {
    if (Node.isNewExpression(node)) {
      return node.getExpression().getText() === "Date";
    }
    return Node.isPropertyAccessExpression(node) && node.getText() === "Date.parse";
  });
}