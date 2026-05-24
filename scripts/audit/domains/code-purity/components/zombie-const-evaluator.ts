import {
  Node,
  SyntaxKind,
  VariableDeclarationKind,
  type Expression,
  type Identifier,
  type Node as MorphNode,
  type VariableDeclaration,
} from "ts-morph";

type ZombieConstValue =
  | { kind: "boolean"; value: boolean }
  | { kind: "null"; value: null }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "undefined"; value: undefined };

const unwrapZombieConstExpression = (expression: Expression): Expression => {
  let current = expression;
  while (
    Node.isAsExpression(current)
    || Node.isNonNullExpression(current)
    || Node.isParenthesizedExpression(current)
    || Node.isSatisfiesExpression(current)
    || Node.isTypeAssertion(current)
  ) {
    if (Node.isParenthesizedExpression(current)) {
      current = current.getExpression();
      continue;
    }
    if (Node.isNonNullExpression(current)) {
      current = current.getExpression();
      continue;
    }
    current = current.getExpression();
  }
  return current;
};

const toZombieConstBoolean = (value: ZombieConstValue): boolean => {
  if (value.kind === "boolean") {
    return value.value;
  }
  if (value.kind === "number") {
    return value.value !== 0 && !Number.isNaN(value.value);
  }
  if (value.kind === "string") {
    return value.value.length > 0;
  }
  return false;
};

const compareZombieConstValues = (
  left: ZombieConstValue,
  right: ZombieConstValue,
  operator: string,
): boolean | undefined => {
  if (operator === "===" || operator === "!==") {
    const equal = left.kind === right.kind && left.value === right.value;
    return operator === "===" ? equal : !equal;
  }
  if (left.kind === "number" && right.kind === "number") {
    if (operator === ">") {
      return left.value > right.value;
    }
    if (operator === ">=") {
      return left.value >= right.value;
    }
    if (operator === "<") {
      return left.value < right.value;
    }
    if (operator === "<=") {
      return left.value <= right.value;
    }
  }
  if (left.kind === "string" && right.kind === "string") {
    if (operator === ">") {
      return left.value > right.value;
    }
    if (operator === ">=") {
      return left.value >= right.value;
    }
    if (operator === "<") {
      return left.value < right.value;
    }
    if (operator === "<=") {
      return left.value <= right.value;
    }
  }
  return undefined;
};

const resolveConstDeclaration = (identifier: Identifier): VariableDeclaration | undefined => {
  const symbol = identifier.getSymbol();
  if (!symbol) {
    return undefined;
  }
  return symbol.getDeclarations().find((declaration) => {
    if (!Node.isVariableDeclaration(declaration) || declaration.getSourceFile() !== identifier.getSourceFile()) {
      return false;
    }
    const declarationList = declaration.getFirstAncestorByKind(SyntaxKind.VariableDeclarationList);
    return declarationList?.getDeclarationKind() === VariableDeclarationKind.Const;
  }) as VariableDeclaration | undefined;
};

const evaluateZombieConstValue = (
  expression: Expression,
  visited: Set<number>,
): ZombieConstValue | undefined => {
  const current = unwrapZombieConstExpression(expression);
  const currentStart = current.getStart();
  if (visited.has(currentStart)) {
    return undefined;
  }
  visited.add(currentStart);

  if (Node.isTrueLiteral(current)) {
    return { kind: "boolean", value: true };
  }
  if (Node.isFalseLiteral(current)) {
    return { kind: "boolean", value: false };
  }
  if (Node.isNumericLiteral(current)) {
    return { kind: "number", value: Number(current.getLiteralValue()) };
  }
  if (Node.isStringLiteral(current) || Node.isNoSubstitutionTemplateLiteral(current)) {
    return { kind: "string", value: current.getLiteralValue() };
  }
  if (current.getKind() === SyntaxKind.NullKeyword) {
    return { kind: "null", value: null };
  }
  if (Node.isIdentifier(current)) {
    if (current.getText() === "undefined") {
      return { kind: "undefined", value: undefined };
    }
    const declaration = resolveConstDeclaration(current);
    const initializer = declaration?.getInitializer();
    return initializer ? evaluateZombieConstValue(initializer, visited) : undefined;
  }
  if (Node.isPrefixUnaryExpression(current)) {
    const operandValue = evaluateZombieConstValue(current.getOperand(), visited);
    if (!operandValue) {
      return undefined;
    }
    if (current.getOperatorToken() === SyntaxKind.ExclamationToken) {
      return { kind: "boolean", value: !toZombieConstBoolean(operandValue) };
    }
    if (operandValue.kind === "number" && current.getOperatorToken() === SyntaxKind.MinusToken) {
      return { kind: "number", value: -operandValue.value };
    }
    if (operandValue.kind === "number" && current.getOperatorToken() === SyntaxKind.PlusToken) {
      return { kind: "number", value: operandValue.value };
    }
  }
  if (Node.isCallExpression(current) && current.getExpression().getText() === "Boolean") {
    const argument = current.getArguments()[0];
    if (argument && Node.isExpression(argument)) {
      const value = evaluateZombieConstValue(argument, visited);
      if (value) {
        return { kind: "boolean", value: toZombieConstBoolean(value) };
      }
    }
  }
  if (Node.isBinaryExpression(current)) {
    const operator = current.getOperatorToken().getText();
    if (operator === "&&" || operator === "||") {
      const leftValue = evaluateZombieConstValue(current.getLeft(), visited);
      const rightValue = evaluateZombieConstValue(current.getRight(), visited);
      if (!leftValue || !rightValue) {
        return undefined;
      }
      return {
        kind: "boolean",
        value: operator === "&&"
          ? toZombieConstBoolean(leftValue) && toZombieConstBoolean(rightValue)
          : toZombieConstBoolean(leftValue) || toZombieConstBoolean(rightValue),
      };
    }
    const leftValue = evaluateZombieConstValue(current.getLeft(), visited);
    const rightValue = evaluateZombieConstValue(current.getRight(), visited);
    if (!leftValue || !rightValue) {
      return undefined;
    }
    const comparison = compareZombieConstValues(leftValue, rightValue, operator);
    return comparison === undefined ? undefined : { kind: "boolean", value: comparison };
  }

  return undefined;
};

export const evaluateZombieBooleanExpression = (expression: Expression): boolean | undefined => {
  const current = unwrapZombieConstExpression(expression);
  if (Node.isBinaryExpression(current)) {
    const leftValue = evaluateZombieConstValue(current.getLeft(), new Set<number>());
    const rightValue = evaluateZombieConstValue(current.getRight(), new Set<number>());
    if (leftValue && rightValue) {
      const comparison = compareZombieConstValues(leftValue, rightValue, current.getOperatorToken().getText());
      if (comparison !== undefined) {
        return comparison;
      }
    }
  }
  const value = evaluateZombieConstValue(expression, new Set<number>());
  return value ? toZombieConstBoolean(value) : undefined;
};