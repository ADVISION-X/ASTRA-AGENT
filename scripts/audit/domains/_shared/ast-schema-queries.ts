import { Node, SyntaxKind, type MethodDeclaration, type SourceFile } from "ts-morph";

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

function resolveObjectLiteralExpression(node: Node | undefined): import("ts-morph").ObjectLiteralExpression | undefined {
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
}

function resolveZodObjectCall(node: Node | undefined): import("ts-morph").CallExpression | undefined {
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

export function getFunctionLike(sourceFile: SourceFile, name: string): Node | null {
  const variableInitializer = sourceFile.getVariableDeclaration(name)?.getInitializer();
  if (variableInitializer && (Node.isArrowFunction(variableInitializer) || Node.isFunctionExpression(variableInitializer))) {
    return variableInitializer;
  }

  return sourceFile.getFunction(name) ?? null;
}

export function getClassMethod(sourceFile: SourceFile, className: string, methodName: string): MethodDeclaration | null {
  return sourceFile.getClass(className)?.getMethod(methodName) ?? null;
}

export function hasInterfaceMethod(sourceFile: SourceFile, interfaceName: string, methodName: string): boolean {
  return Boolean(sourceFile.getInterface(interfaceName)?.getMethod(methodName));
}

function unwrapExpression(node: Node | undefined): Node | undefined {
  if (!node) {
    return undefined;
  }

  if (Node.isAsExpression(node) || Node.isSatisfiesExpression(node) || Node.isParenthesizedExpression(node)) {
    return unwrapExpression(node.getExpression());
  }

  return node;
}

function isZodObjectCall(callExpression: Node): boolean {
  if (!Node.isCallExpression(callExpression)) {
    return false;
  }

  const expression = callExpression.getExpression();
  return Node.isPropertyAccessExpression(expression)
    && expression.getExpression().getText() === "z"
    && expression.getName() === "object";
}