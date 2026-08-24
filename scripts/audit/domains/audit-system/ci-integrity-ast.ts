import { Node, SyntaxKind, type FunctionDeclaration, type Node as MorphNode } from "ts-morph";

import { isDefinitelyUnreachable } from "./control-flow-reachability.js";

export const identifierNames = (declaration: FunctionDeclaration | undefined): Set<string> =>
  new Set(declaration?.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText()) ?? []);

const propertyNames = (nodes: readonly MorphNode[]): Set<string> => new Set(nodes.flatMap((node) => {
  if (Node.isPropertyAssignment(node)) {
    const name = node.getNameNode();
    if (Node.isStringLiteral(name)) return [name.getLiteralValue()];
    if (Node.isIdentifier(name)) return [name.getText()];
  }
  return Node.isShorthandPropertyAssignment(node) ? [node.getName()] : [];
}));

const isDirectlyExecuted = (node: MorphNode, declaration: FunctionDeclaration): boolean =>
  node.getFirstAncestor(Node.isFunctionLikeDeclaration) === declaration
  && !isDefinitelyUnreachable(node, declaration);

export const directCallNames = (declaration: FunctionDeclaration | undefined): string[] =>
  declaration?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => isDirectlyExecuted(call, declaration))
    .flatMap((call) => {
      const expression = call.getExpression();
      if (Node.isIdentifier(expression)) return [expression.getText()];
      if (Node.isPropertyAccessExpression(expression)) return [expression.getName()];
      return [];
    }) ?? [];

export const directObjectPropertyNames = (
  declaration: FunctionDeclaration | undefined,
  variableName: string,
): Set<string> => {
  const variable = declaration?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((candidate) => candidate.getName() === variableName && declaration
      && isDirectlyExecuted(candidate, declaration));
  const object = variable?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
  return object ? propertyNames(object.getProperties()) : new Set();
};

export const directVariableCalls = (
  declaration: FunctionDeclaration | undefined,
  variableName: string,
  callName: string,
): boolean => {
  const variable = declaration?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((candidate) => candidate.getName() === variableName && declaration
      && isDirectlyExecuted(candidate, declaration));
  const initializer = variable?.getInitializer();
  if (!Node.isCallExpression(initializer)) return false;
  const expression = initializer.getExpression();
  return Node.isIdentifier(expression) && expression.getSymbol()?.getName() === callName;
};
