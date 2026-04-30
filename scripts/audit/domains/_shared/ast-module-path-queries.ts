import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { flattenPropertyAccess } from "./ast-helpers.js";

export function hasExportModuleSpecifier(sourceFile: SourceFile, marker: string): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => {
    const specifier = declaration.getModuleSpecifierValue() ?? "";
    return specifier.includes(marker);
  });
}

export function hasCallExpressionWithStringLiteralArgument(node: Node, pathParts: string[], literalValue: string): boolean {
  return node.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expressionPath = flattenPropertyAccess(callExpression.getExpression());
    if (expressionPath.length !== pathParts.length || !expressionPath.every((part, index) => part === pathParts[index])) {
      return false;
    }

    return callExpression.getArguments().some((argument) => {
      return (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))
        && argument.getLiteralText() === literalValue;
    });
  });
}

export function hasPropertyAccessName(node: Node, propertyName: string): boolean {
  return node.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => expression.getName() === propertyName);
}