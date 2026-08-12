import { Node, SyntaxKind, type CallExpression, type Node as MorphNode, type VariableDeclaration } from "ts-morph";

export const resolvesTo = (node: MorphNode | undefined, declaration: MorphNode): boolean => {
  const symbol = node?.getSymbol();
  return (symbol?.getDeclarations().includes(declaration) ?? false)
    || (symbol?.getAliasedSymbol()?.getDeclarations().includes(declaration) ?? false);
};

export const variableCall = (
  declaration: VariableDeclaration | undefined,
  target: MorphNode,
): CallExpression | null => {
  const initializer = declaration?.getInitializer();
  return Node.isCallExpression(initializer) && resolvesTo(initializer.getExpression(), target) ? initializer : null;
};

export const nodeReferencesDeclaration = (node: MorphNode | undefined, declaration: MorphNode): boolean =>
  Boolean(node && [
    ...(Node.isIdentifier(node) ? [node] : []),
    ...node.getDescendantsOfKind(SyntaxKind.Identifier),
  ].some((identifier) => resolvesTo(identifier, declaration)));
