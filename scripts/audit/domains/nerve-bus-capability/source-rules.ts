import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { flattenPropertyAccess } from "../_shared/ast-helpers.js";

import { FORBIDDEN_IMPORT_PREFIXES } from "./config.js";
import { getExternalImportsWithPrefix } from "./project-access.js";

export function sourceHasDynamicImport(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword);
}

export function sourceHasRequire(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "require";
  });
}

export function sourceHasExportStar(sourceFile: SourceFile): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.isNamespaceExport() || declaration.getText().startsWith("export *"));
}

export function sourceHasForbiddenImport(sourceFile: SourceFile): boolean {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const target = declaration.getModuleSpecifierSourceFile();
    const targetPath = target?.getFilePath();
    return targetPath !== undefined && FORBIDDEN_IMPORT_PREFIXES.some((prefix) => targetPath.includes(prefix));
  });
}

export function sourceHasNewDateOutsideClock(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => {
    if (Node.isNewExpression(node)) {
      return node.getExpression().getText() === "Date";
    }
    return Node.isPropertyAccessExpression(node) && node.getText() === "Date.parse";
  });
}

export function sourceUsesComputedHandlerAccess(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => {
    if (!Node.isElementAccessExpression(node)) {
      return false;
    }
    const expressionPath = flattenPropertyAccess(node.getExpression()).join(".");
    if (!expressionPath.endsWith("handlerPort")) {
      return false;
    }
    const argument = node.getArgumentExpression();
    return argument !== undefined && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument)) && ["dispatchAbilityCommand", "dispatchHumanCommand", "requestAi"].includes(argument.getLiteralText());
  });
}