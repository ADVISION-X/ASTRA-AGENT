import { Node, SyntaxKind, VariableDeclarationKind, type FunctionDeclaration, type Node as MorphNode, type Statement } from "ts-morph";

const literalBoolean = (node: MorphNode): boolean | null => {
  if (Node.isTrueLiteral(node)) return true;
  if (Node.isFalseLiteral(node) || Node.isNullLiteral(node)) return false;
  if (Node.isNumericLiteral(node)) {
    const value = Number(node.getLiteralText().replaceAll("_", ""));
    return value !== 0 && !Number.isNaN(value);
  }
  if (Node.isBigIntLiteral(node)) return BigInt(node.getLiteralText().replaceAll("_", "").slice(0, -1)) !== 0n;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralValue().length > 0;
  return null;
};

const constInitializer = (node: MorphNode): MorphNode | undefined => {
  if (!Node.isIdentifier(node)) return undefined;
  const declarations = node.getSymbol()?.getDeclarations().filter(Node.isVariableDeclaration) ?? [];
  const declaration = declarations.length === 1 ? declarations[0] : undefined;
  return declaration?.getVariableStatement()?.getDeclarationKind() === VariableDeclarationKind.Const
    ? declaration.getInitializer() : undefined;
};

const staticBoolean = (node: MorphNode | undefined, visited: ReadonlySet<MorphNode> = new Set()): boolean | null => {
  if (!node || visited.has(node)) return null;
  const literal = literalBoolean(node);
  if (literal !== null) return literal;
  const nextVisited = new Set(visited).add(node);
  const initializer = constInitializer(node);
  if (initializer) return staticBoolean(initializer, nextVisited);
  if (Node.isParenthesizedExpression(node)) return staticBoolean(node.getExpression(), nextVisited);
  if (Node.isPrefixUnaryExpression(node) && node.getOperatorToken() === SyntaxKind.ExclamationToken) {
    const value = staticBoolean(node.getOperand(), nextVisited);
    return value === null ? null : !value;
  }
  if (Node.isPrefixUnaryExpression(node)
    && [SyntaxKind.PlusToken, SyntaxKind.MinusToken].includes(node.getOperatorToken())) {
    return staticBoolean(node.getOperand(), nextVisited);
  }
  return null;
};

const containsNode = (container: MorphNode, node: MorphNode): boolean =>
  container.getStart() <= node.getStart() && node.getEnd() <= container.getEnd();

const isDirectTerminal = (statement: Statement): boolean =>
  Node.isReturnStatement(statement) || Node.isThrowStatement(statement)
  || Node.isBreakStatement(statement) || Node.isContinueStatement(statement);

const statementTerminates = (statement: Statement): boolean => {
  if (isDirectTerminal(statement)) return true;
  if (Node.isBlock(statement)) return statement.getStatements().some(statementTerminates);
  if (Node.isIfStatement(statement)) {
    const value = staticBoolean(statement.getExpression());
    const otherwise = statement.getElseStatement();
    if (value === true) return statementTerminates(statement.getThenStatement());
    if (value === false) return otherwise !== undefined && statementTerminates(otherwise);
    return otherwise !== undefined && statementTerminates(statement.getThenStatement()) && statementTerminates(otherwise);
  }
  if (!Node.isTryStatement(statement)) return false;
  const finalizer = statement.getFinallyBlock();
  if (finalizer && statementTerminates(finalizer)) return true;
  const handler = statement.getCatchClause();
  return handler ? statementTerminates(statement.getTryBlock()) && statementTerminates(handler.getBlock())
    : statementTerminates(statement.getTryBlock());
};

const precedingStatementTerminates = (node: MorphNode, boundary: MorphNode): boolean => {
  for (const ancestor of [node, ...node.getAncestors()]) {
    const block = ancestor.getParent();
    if (!Node.isBlock(block)) {
      if (ancestor === boundary) break;
      continue;
    }
    const containingStatement = block.getStatements().find((statement) => containsNode(statement, node));
    if (containingStatement) {
      const index = block.getStatements().indexOf(containingStatement);
      if (block.getStatements().slice(0, index).some(statementTerminates)) return true;
    }
    if (block === boundary || ancestor === boundary) break;
  }
  return false;
};

const branchIsUnreachable = (node: MorphNode, ancestor: MorphNode): boolean => {
  if (Node.isIfStatement(ancestor)) {
    const value = staticBoolean(ancestor.getExpression());
    const otherwise = ancestor.getElseStatement();
    return (value === false && containsNode(ancestor.getThenStatement(), node))
      || (value === true && otherwise !== undefined && containsNode(otherwise, node));
  }
  if (!Node.isConditionalExpression(ancestor)) return false;
  const value = staticBoolean(ancestor.getCondition());
  return (value === false && containsNode(ancestor.getWhenTrue(), node))
    || (value === true && containsNode(ancestor.getWhenFalse(), node));
};

const shortCircuitIsUnreachable = (node: MorphNode, ancestor: MorphNode): boolean => {
  if (!Node.isBinaryExpression(ancestor) || !containsNode(ancestor.getRight(), node)) return false;
  const value = staticBoolean(ancestor.getLeft());
  const operator = ancestor.getOperatorToken().getKind();
  return (operator === SyntaxKind.AmpersandAmpersandToken && value === false)
    || (operator === SyntaxKind.BarBarToken && value === true);
};

const loopIsUnreachable = (node: MorphNode, ancestor: MorphNode): boolean =>
  (Node.isWhileStatement(ancestor) && staticBoolean(ancestor.getExpression()) === false
    && containsNode(ancestor.getStatement(), node))
  || (Node.isForStatement(ancestor) && staticBoolean(ancestor.getCondition()) === false
    && containsNode(ancestor.getStatement(), node));

export const isDefinitelyUnreachable = (node: MorphNode, boundary: MorphNode): boolean => {
  if (precedingStatementTerminates(node, boundary)) return true;
  for (const ancestor of node.getAncestors()) {
    if (ancestor === boundary) return false;
    if (branchIsUnreachable(node, ancestor) || shortCircuitIsUnreachable(node, ancestor)
      || loopIsUnreachable(node, ancestor)) return true;
  }
  return false;
};

export const callNamesInOrder = (declaration: FunctionDeclaration | undefined): string[] =>
  declaration?.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
    const expression = call.getExpression();
    if (Node.isIdentifier(expression)) return [expression.getText()];
    if (Node.isPropertyAccessExpression(expression)) return [expression.getName()];
    return [];
  }) ?? [];

export const callPrecedes = (
  declaration: FunctionDeclaration | undefined,
  earlier: string,
  later: string,
): boolean => {
  const calls = callNamesInOrder(declaration);
  const earlierIndex = calls.indexOf(earlier);
  const laterIndex = calls.indexOf(later);
  return earlierIndex >= 0 && laterIndex > earlierIndex;
};
