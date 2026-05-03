import { Node, SyntaxKind, type SourceFile } from "ts-morph";

const unwrapExpression = (node: Node | undefined): Node | undefined => {
  if (!node) {
    return undefined;
  }

  if (Node.isAsExpression(node) || Node.isSatisfiesExpression(node) || Node.isParenthesizedExpression(node)) {
    return unwrapExpression(node.getExpression());
  }

  return node;
};

const resolveObjectLiteralExpression = (node: Node | undefined): import("ts-morph").ObjectLiteralExpression | undefined => {
  const unwrappedNode = unwrapExpression(node);
  if (!unwrappedNode) {
    return undefined;
  }

  if (Node.isObjectLiteralExpression(unwrappedNode)) {
    return unwrappedNode;
  }

  if (!Node.isIdentifier(unwrappedNode)) {
    return undefined;
  }

  const symbol = unwrappedNode.getSymbol();
  const targetSymbol = symbol?.getAliasedSymbol() ?? symbol;
  for (const declaration of targetSymbol?.getDeclarations() ?? []) {
    if (!Node.isVariableDeclaration(declaration)) {
      continue;
    }

    const resolved = resolveObjectLiteralExpression(declaration.getInitializer());
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
};

const isZodObjectCall = (callExpression: Node): boolean => {
  if (!Node.isCallExpression(callExpression)) {
    return false;
  }

  const expression = callExpression.getExpression();
  return Node.isPropertyAccessExpression(expression)
    && expression.getExpression().getText() === "z"
    && expression.getName() === "object";
};

const resolveZodObjectCall = (node: Node | undefined): import("ts-morph").CallExpression | undefined => {
  if (!node) {
    return undefined;
  }

  if (Node.isCallExpression(node) && isZodObjectCall(node)) {
    return node;
  }

  if (Node.isIdentifier(node)) {
    const symbol = node.getSymbol();
    const targetSymbol = symbol?.getAliasedSymbol() ?? symbol;
    for (const declaration of targetSymbol?.getDeclarations() ?? []) {
      if (!Node.isVariableDeclaration(declaration)) {
        continue;
      }

      const resolved = resolveZodObjectCall(unwrapExpression(declaration.getInitializer()));
      if (resolved) {
        return resolved;
      }
    }
  }

  return node.getDescendantsOfKind(SyntaxKind.CallExpression).find(isZodObjectCall);
};

export function hasCallExpression(node: Node, calleeName: string): boolean {
  return node.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression)
      ? expression.getText() === calleeName
      : Node.isPropertyAccessExpression(expression) && expression.getName() === calleeName;
  });
}

export function hasIdentifier(node: Node, identifierName: string): boolean {
  return node.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === identifierName);
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

export function hasPropertyNamed(node: Node, propertyName: string): boolean {
  return node.getDescendants().some((descendant) => {
    return (Node.isPropertyAssignment(descendant) || Node.isShorthandPropertyAssignment(descendant))
      && descendant.getName() === propertyName;
  });
}

export function getTypeAliasPropertyNames(sourceFile: SourceFile, declarationName: string): Set<string> {
  const declaration = sourceFile.getTypeAlias(declarationName);
  const typeNode = declaration?.getTypeNode();
  if (!typeNode || !Node.isTypeLiteral(typeNode)) {
    return new Set();
  }

  return new Set(
    typeNode
      .getProperties()
      .filter((property) => Node.isPropertySignature(property))
      .map((property) => property.getName()),
  );
}

export function getZodEnumValues(sourceFile: SourceFile, declarationName: string): string[] {
  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const initializer = declaration?.getInitializerIfKind(SyntaxKind.CallExpression);
  const firstArgument = initializer?.getArguments()[0];
  if (!firstArgument) {
    return [];
  }

  const unwrappedArgument = unwrapExpression(firstArgument);
  const enumArray = Node.isArrayLiteralExpression(unwrappedArgument)
    ? unwrappedArgument
    : Node.isIdentifier(firstArgument)
      ? firstArgument.getDefinitions()
        .map((definition) => definition.getDeclarationNode())
        .map((node) => node && Node.isVariableDeclaration(node) ? unwrapExpression(node.getInitializer()) : undefined)
        .find((node) => Boolean(node) && Node.isArrayLiteralExpression(node))
      : undefined;

  if (!enumArray || !Node.isArrayLiteralExpression(enumArray)) {
    return [];
  }

  return enumArray
    .getElements()
    .filter((element) => Node.isStringLiteral(element))
    .map((element) => element.getLiteralText());
}

export function getZodObjectPropertyNames(sourceFile: SourceFile, declarationName: string): Set<string> {
  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const initializer = unwrapExpression(declaration?.getInitializer());
  const objectCall = resolveZodObjectCall(initializer);
  const firstArgument = resolveObjectLiteralExpression(objectCall?.getArguments()[0]);
  if (!firstArgument) {
    return new Set();
  }

  return new Set(
    firstArgument
      .getProperties()
      .filter((property) => Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property))
      .map((property) => property.getName()),
  );
}