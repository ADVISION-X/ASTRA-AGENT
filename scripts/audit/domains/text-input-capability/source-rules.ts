import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { flattenPropertyAccess } from "../_shared/ast-helpers.js";

import { FORBIDDEN_IMPORT_PREFIXES } from "./config.js";

export function sourceHasPrimitiveExecuteCall(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => {
    if (Node.isCallExpression(node)) {
      return flattenPropertyAccess(node.getExpression()).join(".").endsWith("executionPort.execute");
    }
    if (!Node.isElementAccessExpression(node)) {
      return false;
    }
    const argument = node.getArgumentExpression();
    return argument !== undefined && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument)) && argument.getLiteralText() === "execute";
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
    const target = declaration.getModuleSpecifierSourceFile();
    const targetPath = target?.getFilePath();
    return targetPath !== undefined && FORBIDDEN_IMPORT_PREFIXES.some((prefix) => targetPath.includes(prefix));
  });
}

export function sourceHasExportStar(sourceFile: SourceFile): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.isNamespaceExport() || declaration.getText().startsWith("export *"));
}

export function sourceHasNewDateOutsideClock(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => Node.isNewExpression(node) && node.getExpression().getText() === "Date");
}