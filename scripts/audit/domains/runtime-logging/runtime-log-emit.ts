import { Node, type Node as MorphNode } from "ts-morph";

export const getObjectArg = (node: MorphNode): MorphNode | undefined => {
  if (!Node.isCallExpression(node)) return undefined;
  const arg = node.getArguments()[0];
  return arg && Node.isObjectLiteralExpression(arg) ? arg : undefined;
};

export const isEmitCall = (node: MorphNode): boolean => {
  if (!Node.isCallExpression(node)) return false;
  const expression = node.getExpression();
  return Node.isPropertyAccessExpression(expression) && expression.getName() === "emit";
};

export const isRuntimeLogEmitCall = (node: MorphNode): boolean => {
  if (isEmitCall(node)) return true;
  if (!Node.isCallExpression(node)) return false;
  const expression = node.getExpression();
  return Node.isIdentifier(expression) && expression.getText() === "emitRuntimeLog";
};

export const hasObjectProperty = (objectNode: MorphNode, propertyName: string): boolean => {
  if (!Node.isObjectLiteralExpression(objectNode)) return false;
  return objectNode.getProperties().some((property) =>
    (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property))
    && property.getName() === propertyName,
  );
};

export const getPropertyInitializer = (
  objectNode: MorphNode,
  propertyName: string,
): MorphNode | undefined => {
  if (!Node.isObjectLiteralExpression(objectNode)) return undefined;
  const property = objectNode.getProperty(propertyName);
  if (Node.isPropertyAssignment(property)) return property.getInitializer();
  if (Node.isShorthandPropertyAssignment(property)) return property.getNameNode();
  return undefined;
};
