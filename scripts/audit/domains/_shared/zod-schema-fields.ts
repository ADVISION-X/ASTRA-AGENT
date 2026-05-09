import { Node, type SourceFile } from "ts-morph";

const unwrapObjectLiteralNode = (node: Node | undefined): import("ts-morph").ObjectLiteralExpression | null => {
  if (!node) {
    return null;
  }
  if (Node.isObjectLiteralExpression(node)) {
    return node;
  }
  if (Node.isSatisfiesExpression(node) || Node.isAsExpression(node) || Node.isParenthesizedExpression(node)) {
    return unwrapObjectLiteralNode(node.getExpression());
  }
  return null;
};

const resolveIdentifierInitializer = (node: import("ts-morph").Identifier): Node | undefined => {
  const declaration = node.getSymbol()?.getAliasedSymbol()?.getDeclarations()[0] ?? node.getSymbol()?.getDeclarations()[0];
  return Node.isVariableDeclaration(declaration) ? declaration.getInitializer() : undefined;
};

const getObjectLiteralPropertyNames = (node: Node | undefined): Set<string> => {
  const objectLiteral = unwrapObjectLiteralNode(node);
  if (!objectLiteral) {
    return new Set();
  }

  return new Set(objectLiteral.getProperties().flatMap((property) => {
    if (Node.isSpreadAssignment(property)) {
      const expression = property.getExpression();
      if (!Node.isIdentifier(expression)) {
        return [];
      }
      return [...getZodShapePropertyNamesFromNode(resolveIdentifierInitializer(expression))];
    }
    return Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property) ? [property.getName()] : [];
  }));
};

const isShapePassthroughCall = (expression: Node): expression is import("ts-morph").PropertyAccessExpression =>
  Node.isPropertyAccessExpression(expression)
  && (expression.getName() === "strict" || expression.getName() === "superRefine" || expression.getName() === "default" || expression.getName() === "nullable");

const isShapeExtendCall = (expression: Node): expression is import("ts-morph").PropertyAccessExpression =>
  Node.isPropertyAccessExpression(expression) && expression.getName() === "extend";

const isShapeMergeCall = (expression: Node): expression is import("ts-morph").PropertyAccessExpression =>
  Node.isPropertyAccessExpression(expression) && expression.getName() === "merge";

const collectExtendedShapePropertyNames = (
  node: import("ts-morph").CallExpression,
  expression: import("ts-morph").PropertyAccessExpression,
): Set<string> => {
  const fields = getZodShapePropertyNamesFromNode(expression.getExpression());
  for (const propertyName of getObjectLiteralPropertyNames(node.getArguments()[0])) {
    fields.add(propertyName);
  }
  return fields;
};

const collectMergedShapePropertyNames = (
  node: import("ts-morph").CallExpression,
  expression: import("ts-morph").PropertyAccessExpression,
): Set<string> => {
  const fields = getZodShapePropertyNamesFromNode(expression.getExpression());
  const [mergeArgument] = node.getArguments();
  for (const propertyName of getZodShapePropertyNamesFromNode(mergeArgument)) {
    fields.add(propertyName);
  }
  return fields;
};

const collectIdentifierShapePropertyNames = (node: import("ts-morph").Identifier): Set<string> =>
  getZodShapePropertyNamesFromNode(resolveIdentifierInitializer(node));

const collectCallShapePropertyNames = (node: import("ts-morph").CallExpression): Set<string> => {
  const expression = node.getExpression();
  if (isShapePassthroughCall(expression)) {
    return getZodShapePropertyNamesFromNode(expression.getExpression());
  }
  if (isShapeExtendCall(expression)) {
    return collectExtendedShapePropertyNames(node, expression);
  }
  if (isShapeMergeCall(expression)) {
    return collectMergedShapePropertyNames(node, expression);
  }

  return getObjectLiteralPropertyNames(node.getArguments()[0]);
};

export const getZodShapePropertyNamesFromNode = (node: Node | undefined): Set<string> => {
  if (!node) {
    return new Set();
  }
  if (Node.isIdentifier(node)) {
    return collectIdentifierShapePropertyNames(node);
  }
  if (!Node.isCallExpression(node)) {
    return new Set();
  }
  return collectCallShapePropertyNames(node);
};

export const getZodShapePropertyNames = (sourceFile: SourceFile, declarationName: string): Set<string> =>
  getZodShapePropertyNamesFromNode(sourceFile.getVariableDeclaration(declarationName)?.getInitializer());
