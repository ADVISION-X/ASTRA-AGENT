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
    if (!declaration || !Node.isVariableDeclaration(declaration)) continue;
    const initializer = declaration.getInitializer();
    if (initializer) extractEventTypeStrings(initializer, out);
  }
};

const resolvePropertyAccess = (node: MorphNode, out: Set<string>): void => {
  if (!Node.isPropertyAccessExpression(node)) return;
  const declaration = node.getNameNode().getSymbol()?.getDeclarations()[0];
  if (!declaration || !Node.isPropertyAssignment(declaration)) return;
  const initializer = declaration.getInitializer();
  if (initializer) extractEventTypeStrings(initializer, out);
};
