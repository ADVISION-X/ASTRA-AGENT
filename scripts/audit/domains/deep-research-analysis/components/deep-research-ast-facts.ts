import { Node, SyntaxKind, type Expression, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../../shared/ast-node-identity.js";

const identifierName = (expression: Expression): string | null =>
  Node.isIdentifier(expression) ? astIdentifierName(expression) ?? null : null;

export const propertyAccessSegments = (expression: Expression): string[] | null => {
  const segments: string[] = [];
  let current: Expression = expression;
  while (Node.isPropertyAccessExpression(current)) {
    segments.unshift(current.getName());
    current = current.getExpression();
  }
  const root = identifierName(current);
  if (!root) return null;
  segments.unshift(root);
  return segments;
};

export const hasPropertyAccessSegments = (
  sourceFile: SourceFile | undefined,
  expected: readonly string[],
): boolean =>
  Boolean(sourceFile?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => {
    const actual = propertyAccessSegments(expression);
    return actual?.length === expected.length
      && actual.every((segment, index) => segment === expected[index]);
  }));

export const hasIdentifierName = (sourceFile: SourceFile | undefined, value: string): boolean =>
  Boolean(sourceFile?.getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => astIdentifierName(identifier) === value));

export const hasLiteralValue = (sourceFile: SourceFile | undefined, value: string): boolean =>
  Boolean(sourceFile?.getDescendants().some((node) =>
    (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))
      && node.getLiteralText() === value));

export const hasLiteralFragment = (sourceFile: SourceFile | undefined, value: string): boolean =>
  Boolean(sourceFile?.getDescendants().some((node) => {
    if (Node.isStringLiteral(node)
      || Node.isNoSubstitutionTemplateLiteral(node)
      || Node.isTemplateHead(node)
      || Node.isTemplateMiddle(node)
      || Node.isTemplateTail(node)) {
      return node.getLiteralText().includes(value);
    }
    return false;
  }));

export const hasPropertyName = (sourceFile: SourceFile | undefined, value: string): boolean =>
  Boolean(sourceFile?.getDescendants().some((node) =>
    (Node.isPropertyAssignment(node)
      || Node.isPropertySignature(node)
      || Node.isMethodDeclaration(node)
      || Node.isMethodSignature(node))
      && node.getName() === value));

export const hasAstNameOrLiteral = (sourceFile: SourceFile | undefined, value: string): boolean =>
  hasIdentifierName(sourceFile, value)
  || hasPropertyName(sourceFile, value)
  || hasLiteralValue(sourceFile, value);
