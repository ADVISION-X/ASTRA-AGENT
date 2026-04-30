import { Node, SyntaxKind, type CatchClause, type Node as MorphNode, type ParameterDeclaration, type SourceFile, type Type } from "ts-morph";

import { FUNCTION_DECISION_KINDS } from "./purity-ast-kinds.js";
import type { PurityFunctionNode } from "./purity-types.js";

const isSameOwningFunction = (candidate: MorphNode, functionNode: PurityFunctionNode): boolean => {
  const owner = candidate.getFirstAncestor((ancestor) =>
    Node.isArrowFunction(ancestor)
    || Node.isConstructorDeclaration(ancestor)
    || Node.isFunctionDeclaration(ancestor)
    || Node.isFunctionExpression(ancestor)
    || Node.isMethodDeclaration(ancestor),
  );

  return owner === functionNode;
};

export const getFunctionNodes = (sourceFile: SourceFile): PurityFunctionNode[] => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.Constructor),
];

export const getLogicalLineCount = (functionNode: PurityFunctionNode): number => {
  const body = functionNode.getBody();
  if (!body) {
    return 0;
  }

  return body
    .getText()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== "{" && line !== "}").length;
};

export const getFunctionName = (functionNode: PurityFunctionNode, relativePath: string): string => {
  if (Node.isConstructorDeclaration(functionNode)) {
    return "constructor";
  }

  const directName = "getName" in functionNode ? functionNode.getName() : undefined;
  if (directName) {
    return directName;
  }

  const variableDeclaration = functionNode.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (variableDeclaration) {
    return variableDeclaration.getName();
  }

  const propertyAssignment = functionNode.getFirstAncestorByKind(SyntaxKind.PropertyAssignment);
  if (propertyAssignment) {
    return propertyAssignment.getName();
  }

  return `${relativePath}:${functionNode.getStartLineNumber()}`;
};

export const isExportedFunction = (functionNode: PurityFunctionNode): boolean => {
  if (Node.isFunctionDeclaration(functionNode) && functionNode.hasExportKeyword()) {
    return true;
  }

  const variableStatement = functionNode.getFirstAncestorByKind(SyntaxKind.VariableStatement);
  return variableStatement?.hasExportKeyword() ?? false;
};

export const getFunctionMetrics = (functionNode: PurityFunctionNode) => {
  const descendants = functionNode.getDescendants().filter((candidate) => isSameOwningFunction(candidate, functionNode));
  let maxDepth = 0;
  let complexity = 1;
  let cognitive = 0;

  for (const candidate of descendants) {
    const isDecision = FUNCTION_DECISION_KINDS.has(candidate.getKind()) || (
      Node.isBinaryExpression(candidate)
      && [SyntaxKind.AmpersandAmpersandToken, SyntaxKind.BarBarToken].includes(candidate.getOperatorToken().getKind())
    );
    if (!isDecision) {
      continue;
    }

    const depth = candidate
      .getAncestors()
      .filter(
        (ancestor) => ancestor !== functionNode && isSameOwningFunction(ancestor, functionNode) && FUNCTION_DECISION_KINDS.has(ancestor.getKind()),
      ).length + 1;

    maxDepth = Math.max(maxDepth, depth);
    complexity += 1;
    cognitive += depth;
  }

  return { maxDepth, complexity, cognitive };
};

const isBooleanLikeType = (type: Type): boolean => {
  if (type.isBoolean() || type.isBooleanLiteral()) {
    return true;
  }

  if (!type.isUnion()) {
    return false;
  }

  return type.getUnionTypes().every((member) =>
    member.isBoolean() || member.isBooleanLiteral() || member.getText() === "undefined",
  );
};

const isBooleanLikeParameter = (parameter: ParameterDeclaration): boolean => {
  const typeNode = parameter.getTypeNode();
  if (typeNode?.getKind() === SyntaxKind.BooleanKeyword) {
    return true;
  }

  const initializer = parameter.getInitializer();
  if (initializer && (Node.isTrueLiteral(initializer) || Node.isFalseLiteral(initializer))) {
    return true;
  }

  return isBooleanLikeType(parameter.getType());
};

export const getBooleanLikeParameterCount = (functionNode: PurityFunctionNode): number =>
  functionNode.getParameters().filter((parameter) => isBooleanLikeParameter(parameter)).length;

export const isSilentCatchClause = (catchClause: CatchClause): boolean => {
  const block = catchClause.getBlock();
  if (block.getStatements().length === 0) {
    return true;
  }

  const hasThrow = block.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0;
  if (hasThrow) {
    return false;
  }

  const hasCall = block.getDescendantsOfKind(SyntaxKind.CallExpression).length > 0;
  if (hasCall) {
    return false;
  }

  return true;
};