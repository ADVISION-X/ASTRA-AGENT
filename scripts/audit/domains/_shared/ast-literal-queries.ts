import { Node, SyntaxKind } from "ts-morph";

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
