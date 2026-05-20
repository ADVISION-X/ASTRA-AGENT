import { Node, type Node as MorphNode } from "ts-morph";

export const extractEventTypeStrings = (node: MorphNode, out: Set<string>): void => {
  if (Node.isStringLiteral(node)) {
    out.add(node.getLiteralText());
    return;
  }
  if (Node.isAsExpression(node) || Node.isParenthesizedExpression(node)) {
    extractEventTypeStrings(node.getExpression(), out);
    return;
  }
  if (Node.isConditionalExpression(node)) {
    extractEventTypeStrings(node.getWhenTrue(), out);
    extractEventTypeStrings(node.getWhenFalse(), out);
    return;
  }
  if (Node.isBinaryExpression(node)) {
    extractEventTypeStrings(node.getLeft(), out);
    extractEventTypeStrings(node.getRight(), out);
    return;
  }
  if (Node.isIdentifier(node)) {
    resolveIdentifier(node, out);
    return;
  }
  if (Node.isPropertyAccessExpression(node)) {
    resolvePropertyAccess(node, out);
  }
};

const resolveIdentifier = (node: MorphNode, out: Set<string>): void => {
  if (!Node.isIdentifier(node)) return;
  for (const definition of node.getDefinitions()) {
    const declaration = definition.getDeclarationNode();
    if (!declaration) continue;
    if (Node.isVariableDeclaration(declaration)) {
      const initializer = declaration.getInitializer();
      if (initializer) extractEventTypeStrings(initializer, out);
    }
    if (Node.isParameterDeclaration(declaration)) {
      resolveParameterCallArguments(declaration, out);
    }
  }
};

const getFunctionNameForParameter = (declaration: MorphNode): string | undefined => {
  const parent = declaration.getParent();
  if (Node.isFunctionDeclaration(parent)) return parent.getName();
  if (!Node.isArrowFunction(parent) && !Node.isFunctionExpression(parent)) return undefined;
  const owner = parent.getParent();
  return Node.isVariableDeclaration(owner) ? owner.getName() : undefined;
};

const getParameterIndex = (declaration: MorphNode): number => {
  if (!Node.isParameterDeclaration(declaration)) return -1;
  const parent = declaration.getParent();
  if (
    !Node.isFunctionDeclaration(parent)
    && !Node.isArrowFunction(parent)
    && !Node.isFunctionExpression(parent)
  ) {
    return -1;
  }
  return parent.getParameters().indexOf(declaration);
};

const resolveParameterCallArguments = (declaration: MorphNode, out: Set<string>): void => {
  if (!Node.isParameterDeclaration(declaration)) return;
  const parameterIndex = getParameterIndex(declaration);
  const functionName = getFunctionNameForParameter(declaration);
  if (!functionName || parameterIndex < 0) return;
  declaration.getSourceFile().forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const expression = node.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== functionName) return;
    const argument = node.getArguments()[parameterIndex];
    if (argument) extractEventTypeStrings(argument, out);
  });
};

const resolvePropertyAccess = (node: MorphNode, out: Set<string>): void => {
  if (!Node.isPropertyAccessExpression(node)) return;
  const declaration = node.getNameNode().getSymbol()?.getDeclarations()[0];
  if (!declaration || !Node.isPropertyAssignment(declaration)) return;
  const initializer = declaration.getInitializer();
  if (initializer) extractEventTypeStrings(initializer, out);
};
