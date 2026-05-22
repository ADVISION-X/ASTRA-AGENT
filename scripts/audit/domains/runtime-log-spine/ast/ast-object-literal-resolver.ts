import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type Expression,
  type FunctionDeclaration,
  type FunctionExpression,
  type MethodDeclaration,
  type Node as MorphNode,
  type ObjectLiteralExpression,
} from "ts-morph";

import { traceDestructuredBinding, traceVariableInitializer, unwrapExpression } from "./ast-symbol-utils.js";

const MAX_TRACE_DEPTH = 8;

const toExpression = (node: MorphNode | null): Expression | null => {
  if (!node || Node.isImportSpecifier(node) || Node.isImportClause(node) || Node.isNamespaceImport(node)) {
    return null;
  }
  return node as Expression;
};

const getAliasedOrDirectDeclarations = (node: MorphNode): MorphNode[] => {
  const symbol = node.getSymbol();
  if (!symbol) {
    return [];
  }
  const checker = node.getProject().getTypeChecker();
  return (checker.getAliasedSymbol(symbol) ?? symbol).getDeclarations();
};

const resolveReturnStatements = (
  declaration: ArrowFunction | FunctionDeclaration | FunctionExpression | MethodDeclaration,
  depth: number,
): ObjectLiteralExpression | null => {
  const body = declaration.getBody();
  if (!body || depth > MAX_TRACE_DEPTH) {
    return null;
  }
  const bodyExpression = toExpression(unwrapExpression(body));
  if (bodyExpression) {
    const resolved = resolveObjectLiteralExpression(bodyExpression, depth + 1);
    if (resolved) {
      return resolved;
    }
  }
  if (!Node.isBlock(body)) {
    return null;
  }
  for (const returnStatement of body.getDescendantsOfKind(SyntaxKind.ReturnStatement)) {
    const resolved = resolveObjectLiteralExpression(toExpression(returnStatement.getExpression() ?? null), depth + 1);
    if (resolved) {
      return resolved;
    }
  }
  return null;
};

const resolveFunctionDeclarationObject = (declaration: MorphNode, depth: number): ObjectLiteralExpression | null => {
  if (Node.isFunctionDeclaration(declaration) || Node.isFunctionExpression(declaration) || Node.isArrowFunction(declaration) || Node.isMethodDeclaration(declaration)) {
    return resolveReturnStatements(declaration, depth + 1);
  }
  if (!Node.isVariableDeclaration(declaration)) {
    return null;
  }
  const initializer = declaration.getInitializer();
  return initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))
    ? resolveReturnStatements(initializer, depth + 1)
    : null;
};

const resolveCallResultObjectLiteral = (expression: Expression, depth: number): ObjectLiteralExpression | null => {
  if (!Node.isCallExpression(expression) || depth > MAX_TRACE_DEPTH) {
    return null;
  }
  const callee = unwrapExpression(expression.getExpression());
  if (!callee) {
    return null;
  }
  for (const declaration of getAliasedOrDirectDeclarations(callee)) {
    const resolved = resolveFunctionDeclarationObject(declaration, depth + 1);
    if (resolved) {
      return resolved;
    }
  }
  return null;
};

export const resolveObjectLiteralExpression = (expression: Expression | null, depth = 0): ObjectLiteralExpression | null => {
  const target = toExpression(unwrapExpression(expression));
  if (!target || depth > MAX_TRACE_DEPTH) {
    return null;
  }
  if (Node.isObjectLiteralExpression(target)) {
    return target;
  }
  if (Node.isIdentifier(target)) {
    const traced = traceVariableInitializer(target, depth + 1) ?? traceDestructuredBinding(target, depth + 1);
    return resolveObjectLiteralExpression(toExpression(traced), depth + 1);
  }
  return Node.isCallExpression(target) ? resolveCallResultObjectLiteral(target, depth + 1) : null;
};