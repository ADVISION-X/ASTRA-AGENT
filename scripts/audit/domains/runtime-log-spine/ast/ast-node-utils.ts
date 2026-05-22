import { Node, type Expression } from "ts-morph";

export const getStaticMemberName = (expression: Expression): string | null => {
  if (Node.isPropertyAccessExpression(expression)) {
    return expression.getName();
  }
  if (Node.isElementAccessExpression(expression)) {
    const argument = expression.getArgumentExpression();
    return Node.isStringLiteral(argument) ? argument.getLiteralValue() : null;
  }
  return null;
};