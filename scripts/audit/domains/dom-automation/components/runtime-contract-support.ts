import { Node, SyntaxKind, type Expression, type SourceFile } from "ts-morph";

import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import {
  collectStringLiteralNodes,
  objectLiteralPropertyNames,
} from "./collect-dom-automation-project.js";

export const runtimeFinding = (
  lawId: string,
  file: string,
  line: number,
  message: string,
  hint: string,
): Finding => createFinding({ lawId, file, line, severity: "fatal", message, hint });

export const hasSchemaParseCall = (sourceFile: SourceFile, schemaName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getExpression().getText() === schemaName
      && expression.getName() === "parse";
  });

export const hasPropertyAccess = (sourceFile: SourceFile, receiverText: string, name: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((propertyAccess) => {
    return propertyAccess.getExpression().getText() === receiverText && propertyAccess.getName() === name;
  });

export const hasIdentifierCall = (sourceFile: SourceFile, callName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === callName;
  });

export const hasStringLiteral = (sourceFile: SourceFile, value: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === value);

export const hasStaticText = (sourceFile: SourceFile, value: string): boolean =>
  collectStringLiteralNodes(sourceFile).some((literal) => literal.text.includes(value))
  || sourceFile.forEachDescendantAsArray().some((node) => {
    const kind = node.getKind();
    return (
      kind === SyntaxKind.TemplateHead
      || kind === SyntaxKind.TemplateMiddle
      || kind === SyntaxKind.TemplateTail
    ) && node.getText().includes(value);
  });

export const parseResultObjectPropertyNames = (
  sourceFile: SourceFile,
  schemaName: string,
): string[][] => sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
  .filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getExpression().getText() === schemaName
      && expression.getName() === "parse";
  })
  .map((callExpression) => objectLiteralPropertyNames(callExpression.getArguments()[0]));

export const isNotEqualsCheck = (
  expression: Expression,
  leftText: string,
  rightLiteral: string,
): boolean => {
  if (!Node.isBinaryExpression(expression)) return false;
  const operator = expression.getOperatorToken().getKind();
  if (operator !== SyntaxKind.ExclamationEqualsEqualsToken && operator !== SyntaxKind.ExclamationEqualsToken) return false;
  const right = expression.getRight();
  return expression.getLeft().getText() === leftText
    && Node.isStringLiteral(right)
    && right.getLiteralText() === rightLiteral;
};
