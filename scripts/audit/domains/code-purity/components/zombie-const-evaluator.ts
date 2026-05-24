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

const compareOrderedNumbers = (left: number, right: number, operator: string): boolean | undefined => {
  if (operator === ">") {
    return left > right;
  }
  if (operator === ">=") {
    return left >= right;
  }
  if (operator === "<") {
    return left < right;
  }
  if (operator === "<=") {
    return left <= right;
  }
  return undefined;
};

const compareOrderedStrings = (left: string, right: string, operator: string): boolean | undefined => {
  if (operator === ">") {
    return left > right;
  }
  if (operator === ">=") {
    return left >= right;
  }
  if (operator === "<") {
    return left < right;
  }
  if (operator === "<=") {
    return left <= right;
  }
  return undefined;
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
    return compareOrderedNumbers(left.value, right.value, operator);
  }
  if (left.kind === "string" && right.kind === "string") {
    return compareOrderedStrings(left.value, right.value, operator);
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

const evaluateLiteralConstValue = (expression: Expression): ZombieConstValue | undefined => {
  if (Node.isTrueLiteral(expression)) {
    return { kind: "boolean", value: true };
  }
  if (Node.isFalseLiteral(expression)) {
    return { kind: "boolean", value: false };
  }
  if (Node.isNumericLiteral(expression)) {
    return { kind: "number", value: Number(expression.getLiteralValue()) };
  }
  if (Node.isStringLiteral(expression) || Node.isNoSubstitutionTemplateLiteral(expression)) {
    return { kind: "string", value: expression.getLiteralValue() };
  }
  if (expression.getKind() === SyntaxKind.NullKeyword) {
    return { kind: "null", value: null };
  }
  return undefined;
};

const evaluateIdentifierConstValue = (
  identifier: Identifier,
  visited: Set<number>,
): ZombieConstValue | undefined => {
  if (identifier.getText() === "undefined") {
    return { kind: "undefined", value: undefined };
  }
  const declaration = resolveConstDeclaration(identifier);
  const initializer = declaration?.getInitializer();
  return initializer ? evaluateZombieConstValue(initializer, visited) : undefined;
};

const evaluateUnaryConstValue = (
  expression: MorphNode,
  visited: Set<number>,
): ZombieConstValue | undefined => {
  if (!Node.isPrefixUnaryExpression(expression)) {
    return undefined;
  }
  const operandValue = evaluateZombieConstValue(expression.getOperand(), visited);
  if (!operandValue) {
    return undefined;
  }
  if (expression.getOperatorToken() === SyntaxKind.ExclamationToken) {
    return { kind: "boolean", value: !toZombieConstBoolean(operandValue) };
  }
  if (operandValue.kind === "number" && expression.getOperatorToken() === SyntaxKind.MinusToken) {
    return { kind: "number", value: -operandValue.value };
  }
  if (operandValue.kind === "number" && expression.getOperatorToken() === SyntaxKind.PlusToken) {
    return { kind: "number", value: operandValue.value };
  }
  return undefined;
};

const evaluateBooleanCallConstValue = (
  expression: MorphNode,
  visited: Set<number>,
): ZombieConstValue | undefined => {
  if (!Node.isCallExpression(expression) || expression.getExpression().getText() !== "Boolean") {
    return undefined;
  }
  const argument = expression.getArguments()[0];
  if (!argument || !Node.isExpression(argument)) {
    return undefined;
  }
  const value = evaluateZombieConstValue(argument, visited);
  return value ? { kind: "boolean", value: toZombieConstBoolean(value) } : undefined;
};

const evaluateBinaryConstValue = (
  expression: MorphNode,
  visited: Set<number>,
): ZombieConstValue | undefined => {
  if (!Node.isBinaryExpression(expression)) {
    return undefined;
  }
  const operator = expression.getOperatorToken().getText();
  const leftValue = evaluateZombieConstValue(expression.getLeft(), visited);
  const rightValue = evaluateZombieConstValue(expression.getRight(), visited);
  if (!leftValue || !rightValue) {
    return undefined;
  }
  if (operator === "&&" || operator === "||") {
    return {
      kind: "boolean",
      value: operator === "&&"
        ? toZombieConstBoolean(leftValue) && toZombieConstBoolean(rightValue)
        : toZombieConstBoolean(leftValue) || toZombieConstBoolean(rightValue),
    };
  }
  const comparison = compareZombieConstValues(leftValue, rightValue, operator);
  return comparison === undefined ? undefined : { kind: "boolean", value: comparison };
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

  const literalValue = evaluateLiteralConstValue(current);
  if (literalValue) {
    return literalValue;
  }
  if (Node.isIdentifier(current)) {
    return evaluateIdentifierConstValue(current, visited);
  }
  const unaryValue = evaluateUnaryConstValue(current, visited);
  if (unaryValue) {
    return unaryValue;
  }
  const booleanCallValue = evaluateBooleanCallConstValue(current, visited);
  if (booleanCallValue) {
    return booleanCallValue;
  }
  const binaryValue = evaluateBinaryConstValue(current, visited);
  if (binaryValue) {
    return binaryValue;
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