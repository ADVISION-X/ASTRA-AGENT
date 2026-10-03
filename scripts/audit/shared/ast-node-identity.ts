import { Node, SyntaxKind, type Node as MorphNode } from "ts-morph";

export const astIdentifierName = (node: MorphNode | undefined): string | undefined =>
  Node.isIdentifier(node) ? node.compilerNode.escapedText.toString() : undefined;

export const astPropertyName = (node: MorphNode | undefined): string | undefined => {
  if (!node) return undefined;
  if (Node.isIdentifier(node)) return astIdentifierName(node);
  if (Node.isStringLiteral(node) || Node.isNumericLiteral(node)
    || Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralText();
  return undefined;
};

export const astExpressionPath = (node: MorphNode | undefined): string | undefined => {
  if (!node) return undefined;
  if (node.getKind() === SyntaxKind.ThisKeyword) return "this";
  if (Node.isParenthesizedExpression(node) || Node.isAsExpression(node)
    || Node.isTypeAssertion(node) || Node.isNonNullExpression(node)) {
    return astExpressionPath(node.getExpression());
  }
  const identifier = astIdentifierName(node);
  if (identifier !== undefined) return identifier;
  if (Node.isPropertyAccessExpression(node)) {
    const owner = astExpressionPath(node.getExpression());
    return owner === undefined ? undefined : `${owner}.${node.getName()}`;
  }
  if (Node.isElementAccessExpression(node)) {
    const owner = astExpressionPath(node.getExpression());
    const property = astPropertyName(node.getArgumentExpression());
    return owner === undefined || property === undefined ? undefined : `${owner}.${property}`;
  }
  return undefined;
};

/** Static syntax facts retain control ancestry, arity and exact literal text; trivia is excluded. */
export const astExecutableTree = (root: MorphNode): string => JSON.stringify(
  [root, ...root.getDescendants()].filter(node =>
    ![node, ...node.getAncestors()].some(ancestor =>
      ancestor.getKind() >= SyntaxKind.FirstJSDocNode && ancestor.getKind() <= SyntaxKind.LastJSDocNode))
    .map(node => {
      const children = node.getChildren().filter(child =>
        child.getKind() < SyntaxKind.FirstJSDocNode || child.getKind() > SyntaxKind.LastJSDocNode);
      return [node.getKind(), children.length, children.length === 0 ? node.getText() : ""];
    }),
);
