import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { flattenPropertyAccess } from "./ast-helpers.js";

export function hasIdentifier(node: Node, identifierName: string): boolean {
  return node.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === identifierName);
}

export function hasStringLiteral(node: Node, literalValue: string): boolean {
  return node.getDescendants().some((descendant) => {
    return (Node.isStringLiteral(descendant) || Node.isNoSubstitutionTemplateLiteral(descendant))
      && descendant.getLiteralText() === literalValue;
  });
}

export function hasLiteralTextFragment(node: Node, fragment: string): boolean {
  return node.getDescendants().some((descendant) => {
    if (Node.isStringLiteral(descendant) || Node.isNoSubstitutionTemplateLiteral(descendant)) {
      return descendant.getLiteralText().includes(fragment);
    }

    if (Node.isTemplateHead(descendant) || Node.isTemplateMiddle(descendant) || Node.isTemplateTail(descendant)) {
      return descendant.getLiteralText().includes(fragment);
    }

    return false;
  });
}

export function hasTypeReference(node: Node, typeName: string): boolean {
  return node.getDescendantsOfKind(SyntaxKind.TypeReference).some((reference) => reference.getTypeName().getText() === typeName);
}

export function hasPropertyNamed(node: Node, propertyName: string): boolean {
  return node.getDescendants().some((descendant) => {
    return (Node.isPropertyAssignment(descendant) || Node.isShorthandPropertyAssignment(descendant))
      && descendant.getName() === propertyName;
  });
}

export function hasMethodNamed(node: Node, methodName: string): boolean {
  return node.getDescendantsOfKind(SyntaxKind.MethodDeclaration).some((method) => method.getName() === methodName);
}

export function hasNullishCoalescingLiteral(node: Node, literalValue: string): boolean {
  return node.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((expression) => {
    if (expression.getOperatorToken().getKind() !== SyntaxKind.QuestionQuestionToken) {
      return false;
    }

    const right = expression.getRight();
    return (Node.isStringLiteral(right) || Node.isNoSubstitutionTemplateLiteral(right))
      && right.getLiteralText() === literalValue;
  });
}

export function hasConsoleLog(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && flattenPropertyAccess(expression).join(".") === "console.log";
  });
}