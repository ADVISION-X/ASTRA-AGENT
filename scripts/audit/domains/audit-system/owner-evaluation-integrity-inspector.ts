import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type CallExpression,
  type FunctionDeclaration,
  type FunctionExpression,
  type MethodDeclaration,
  type Node as MorphNode,
  type ObjectLiteralExpression,
  type ParameterDeclaration,
  type VariableDeclaration,
} from "ts-morph";

import { isDefinitelyUnreachable } from "./control-flow-reachability.js";

const returnedObject = (
  evaluation: FunctionDeclaration | ArrowFunction,
): ObjectLiteralExpression | null => {
  const body = evaluation.getBody();
  const expression = Node.isParenthesizedExpression(body) ? body.getExpression() : body;
  if (Node.isObjectLiteralExpression(expression)) return expression;
  if (!Node.isBlock(body)) return null;
  const returns = body.getDescendantsOfKind(SyntaxKind.ReturnStatement)
    .filter((statement) => statement.getFirstAncestor(Node.isFunctionLikeDeclaration) === evaluation
      && !isDefinitelyUnreachable(statement, evaluation))
    .map((statement) => statement.getExpression())
    .filter(Node.isObjectLiteralExpression);
  return returns.length === 1 ? returns[0] ?? null : null;
};

const propertyValue = (object: ObjectLiteralExpression, name: string): MorphNode | null => {
  const property = object.getProperty(name);
  if (Node.isPropertyAssignment(property)) return property.getInitializer() ?? null;
  if (Node.isShorthandPropertyAssignment(property)) {
    const declarations = property.getValueSymbol()?.getDeclarations().filter(Node.isVariableDeclaration) ?? [];
    const declaration = declarations.length === 1 ? declarations[0] : undefined;
    return declaration?.getNameNode() ?? null;
  }
  return null;
};

const declarationFor = (identifier: MorphNode): VariableDeclaration | null => {
  if (!Node.isIdentifier(identifier)) return null;
  const parent = identifier.getParent();
  const symbol = Node.isShorthandPropertyAssignment(parent) && parent.getNameNode() === identifier
    ? parent.getValueSymbol()
    : identifier.getSymbol();
  const declarations = symbol?.getDeclarations() ?? [];
  const variables = declarations.filter(Node.isVariableDeclaration);
  return variables.length === 1 ? variables[0] ?? null : null;
};

const referencedVariables = (expression: MorphNode): VariableDeclaration[] => {
  const identifiers = [
    ...(Node.isIdentifier(expression) ? [expression] : []),
    ...expression.getDescendantsOfKind(SyntaxKind.Identifier),
  ];
  return [...new Set(identifiers.flatMap((identifier) => {
    const declaration = declarationFor(identifier);
    return declaration ? [declaration] : [];
  }))];
};

const executableBody = (declaration: MorphNode): MorphNode | null => {
  if (Node.isFunctionDeclaration(declaration) || Node.isMethodDeclaration(declaration)) {
    return declaration.getBody() ?? null;
  }
  if (!Node.isVariableDeclaration(declaration)) return null;
  const initializer = declaration.getInitializer();
  return Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)
    ? initializer.getBody()
    : null;
};

type ExecutableFunction = FunctionDeclaration | MethodDeclaration | ArrowFunction | FunctionExpression;

const executableFunction = (declaration: MorphNode): ExecutableFunction | null => {
  if (Node.isFunctionDeclaration(declaration) || Node.isMethodDeclaration(declaration)
    || Node.isArrowFunction(declaration) || Node.isFunctionExpression(declaration)) return declaration;
  if (!Node.isVariableDeclaration(declaration)) return null;
  const initializer = declaration.getInitializer();
  return Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer) ? initializer : null;
};

const directCallsIn = (declaration: MorphNode): CallExpression[] => {
  const functionNode = executableFunction(declaration);
  return functionNode?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getFirstAncestor((ancestor) => ancestor === functionNode) === functionNode
      && !isDefinitelyUnreachable(call, functionNode)) ?? [];
};

const expressionDeclarations = (expression: MorphNode): MorphNode[] => {
  if (Node.isArrowFunction(expression) || Node.isFunctionExpression(expression)) return [expression];
  const symbol = expression.getSymbol();
  const target = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
  return (target?.getDeclarations() ?? []).filter((declaration) =>
    !declaration.getSourceFile().isDeclarationFile());
};

const callDeclarations = (call: MorphNode): MorphNode[] =>
  Node.isCallExpression(call) ? expressionDeclarations(call.getExpression()) : [];

const parameterForArgument = (
  declaration: MorphNode,
  argumentIndex: number,
): ParameterDeclaration | null => {
  if (Node.isVariableDeclaration(declaration)) {
    const initializer = declaration.getInitializer();
    if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
      return initializer.getParameters()[argumentIndex] ?? null;
    }
    return null;
  }
  if (
    !Node.isFunctionDeclaration(declaration)
    && !Node.isMethodDeclaration(declaration)
    && !Node.isArrowFunction(declaration)
    && !Node.isFunctionExpression(declaration)
  ) return null;
  return declaration.getParameters()[argumentIndex] ?? null;
};

const expressionReferencesParameter = (
  expression: MorphNode,
  parameter: ParameterDeclaration,
  visited: Set<MorphNode> = new Set(),
): boolean => {
  const identifiers = [
    ...(Node.isIdentifier(expression) ? [expression] : []),
    ...expression.getDescendantsOfKind(SyntaxKind.Identifier),
  ];
  return identifiers.some((identifier) => identifier.getSymbol()?.getDeclarations().some((declaration) => {
    if (declaration === parameter) return true;
    if (visited.has(declaration)) return false;
    visited.add(declaration);
    if (Node.isVariableDeclaration(declaration)) {
      const initializer = declaration.getInitializer();
      return initializer !== undefined
        && expressionReferencesParameter(initializer, parameter, visited);
    }
    if (Node.isBindingElement(declaration)) {
      const variable = declaration.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
      const initializer = variable?.getInitializer();
      return initializer !== undefined
        && expressionReferencesParameter(initializer, parameter, visited);
    }
    return false;
  }) ?? false);
};

const declarationWritesParameter = (
  declaration: MorphNode,
  parameter: ParameterDeclaration,
  visited: Set<string>,
): boolean => {
  const visitKey = `${declaration.getSourceFile().getFilePath()}:${declaration.getStart()}:${parameter.getStart()}`;
  if (visited.has(visitKey)) return false;
  visited.add(visitKey);
  if (!executableBody(declaration)) return false;
  const calls = directCallsIn(declaration);
  if (calls.some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getName() === "push"
      && expressionReferencesParameter(expression.getExpression(), parameter)
      && call.getArguments().some((argument) => expressionCarriesExecutedWork(
        declaration,
        argument,
        new Set(),
        new Set(),
      ));
  })) return true;
  return calls.some((call) => call.getArguments().some((argument, argumentIndex) =>
    expressionReferencesParameter(argument, parameter)
    && callDeclarations(call).some((target) => {
      const targetParameter = parameterForArgument(target, argumentIndex);
      return targetParameter !== null
        && declarationWritesParameter(target, targetParameter, visited);
    })));
};

const callWritesVariable = (
  ownerFunction: MorphNode,
  call: MorphNode,
  variable: VariableDeclaration,
  visitedVariables: Set<VariableDeclaration>,
  visitedDeclarations: Set<MorphNode>,
): boolean => {
  if (!Node.isCallExpression(call)) return false;
  const expression = call.getExpression();
  if (Node.isPropertyAccessExpression(expression) && expression.getName() === "push") {
    return referencedVariables(expression.getExpression()).some((reference) => reference === variable)
      && call.getArguments().some((argument) => expressionCarriesExecutedWork(
        ownerFunction,
        argument,
        visitedVariables,
        visitedDeclarations,
      ));
  }
  return call.getArguments().some((argument, argumentIndex) =>
    referencedVariables(argument).some((reference) => reference === variable)
    && callDeclarations(call).some((target) => {
      const parameter = parameterForArgument(target, argumentIndex);
      return parameter !== null
        && declarationWritesParameter(target, parameter, new Set());
    }));
};

const returnedExpressions = (declaration: MorphNode): MorphNode[] => {
  const functionNode = executableFunction(declaration);
  if (!functionNode) return [];
  const body = functionNode.getBody();
  if (!body) return [];
  if (Node.isArrowFunction(functionNode) && !Node.isBlock(body)) return [body];
  return body.getDescendantsOfKind(SyntaxKind.ReturnStatement)
    .filter((statement) => statement.getFirstAncestor(Node.isFunctionLikeDeclaration) === functionNode
      && !isDefinitelyUnreachable(statement, functionNode))
    .flatMap((statement) => {
      const expression = statement.getExpression();
      return expression ? [expression] : [];
    });
};

const isCanonicalFindingFactory = (declaration: MorphNode): boolean => {
  const source = declaration.getSourceFile();
  const exported = source.getExportedDeclarations().get("createFinding") ?? [];
  return source.getFilePath().endsWith("/scripts/audit/shared/finding-utils.ts")
    && exported.some((candidate) => candidate === declaration)
    && ((Node.isFunctionDeclaration(declaration) && declaration.getName() === "createFinding")
      || (Node.isVariableDeclaration(declaration) && declaration.getName() === "createFinding"));
};

const declarationReturnsFinding = (
  declaration: MorphNode,
  visited: Set<MorphNode> = new Set(),
): boolean => {
  if (isCanonicalFindingFactory(declaration)) return true;
  if (visited.has(declaration)) return false;
  const nextVisited = new Set(visited).add(declaration);
  return returnedExpressions(declaration).some((expression) =>
    valueCalls(expression, declaration).some((call) => callReturnsFinding(call, nextVisited)));
};

const callReturnsFinding = (call: MorphNode, visited: Set<MorphNode> = new Set()): boolean =>
  Node.isCallExpression(call)
  && callDeclarations(call).some((declaration) => declarationReturnsFinding(declaration, visited));

const valueCalls = (expression: MorphNode | undefined, boundary: MorphNode): MorphNode[] => {
  if (!expression || isDefinitelyUnreachable(expression, boundary)) return [];
  if (
    Node.isParenthesizedExpression(expression)
    || Node.isAwaitExpression(expression)
    || Node.isAsExpression(expression)
    || Node.isTypeAssertion(expression)
    || Node.isNonNullExpression(expression)
    || Node.isSpreadElement(expression)
  ) return valueCalls(expression.getExpression(), boundary);
  if (Node.isConditionalExpression(expression)) {
    return [
      ...valueCalls(expression.getWhenTrue(), boundary),
      ...valueCalls(expression.getWhenFalse(), boundary),
    ];
  }
  if (Node.isArrayLiteralExpression(expression)) {
    return expression.getElements().flatMap((element) => valueCalls(element, boundary));
  }
  if (!Node.isCallExpression(expression)) return [];
  const callee = expression.getExpression();
  const receiverCalls = Node.isPropertyAccessExpression(callee)
    && ["filter", "flatMap", "map"].includes(callee.getName())
    ? valueCalls(callee.getExpression(), boundary)
    : [];
  return [expression, ...receiverCalls];
};

const unwrapTransparentExpression = (expression: MorphNode): MorphNode => {
  let current = expression;
  while (
    Node.isParenthesizedExpression(current)
    || Node.isAsExpression(current)
    || Node.isTypeAssertion(current)
    || Node.isNonNullExpression(current)
  ) current = current.getExpression();
  return current;
};

const isStaticallyEmptyArray = (expression: MorphNode): boolean => {
  const unwrapped = unwrapTransparentExpression(expression);
  if (Node.isArrayLiteralExpression(unwrapped)) return unwrapped.getElements().length === 0;
  if (!Node.isCallExpression(unwrapped) && !Node.isNewExpression(unwrapped)) return false;
  const callee = unwrapTransparentExpression(unwrapped.getExpression());
  if (
    !Node.isIdentifier(callee)
    || callee.getSymbol()?.getEscapedName().toString() !== "Array"
  ) return false;
  const declarations = callee.getSymbol()?.getDeclarations() ?? [];
  if (
    declarations.length === 0
    || declarations.some((declaration) => !declaration.getSourceFile().isDeclarationFile())
  ) return false;
  const args = unwrapped.getArguments();
  if (args.length === 0) return true;
  if (args.length !== 1) return false;
  const length = unwrapTransparentExpression(args[0]!);
  return Node.isNumericLiteral(length) && length.getLiteralValue() === 0;
};

function callReturnsExecutedWork(
  ownerFunction: MorphNode,
  call: MorphNode,
  visitedVariables: Set<VariableDeclaration>,
  visitedDeclarations: Set<MorphNode>,
): boolean {
  if (!Node.isCallExpression(call)) return false;
  if (callReturnsFinding(call)) return true;
  const callee = call.getExpression();
  if (Node.isPropertyAccessExpression(callee) && callee.getName() === "map") {
    const receiver = callee.getExpression();
    const mapper = call.getArguments()[0];
    if (!isStaticallyEmptyArray(receiver) && mapper && expressionDeclarations(mapper)
      .some((declaration) => declarationReturnsFinding(declaration))) return true;
  }
  return callDeclarations(call).some((declaration) => {
    if (declarationReturnsExecutedWork(declaration, visitedDeclarations)) return true;
    const functionNode = executableFunction(declaration);
    if (!functionNode) return false;
    return functionNode.getParameters().some((parameter, index) => {
      const argument = call.getArguments()[index];
      return argument !== undefined
      && returnedExpressions(declaration).some((expression) =>
        expressionReferencesParameter(expression, parameter))
      && expressionCarriesExecutedWork(
        ownerFunction,
        argument,
        visitedVariables,
        visitedDeclarations,
      );
    });
  });
}

function expressionCarriesExecutedWork(
  ownerFunction: MorphNode,
  expression: MorphNode,
  visitedVariables: Set<VariableDeclaration>,
  visitedDeclarations: Set<MorphNode>,
): boolean {
  if (Node.isArrayLiteralExpression(expression) && expression.getElements().length === 0) return false;
  if (valueCalls(expression, ownerFunction).some((call) => callReturnsExecutedWork(
    ownerFunction,
    call,
    visitedVariables,
    visitedDeclarations,
  ))) return true;
  return referencedVariables(expression).some((variable) =>
    variableCarriesExecutedWork(ownerFunction, variable, visitedVariables, visitedDeclarations));
}

function declarationReturnsExecutedWork(
  declaration: MorphNode,
  visitedDeclarations: Set<MorphNode>,
): boolean {
  if (visitedDeclarations.has(declaration)) return false;
  const nextVisited = new Set(visitedDeclarations).add(declaration);
  return returnedExpressions(declaration).some((expression) =>
    expressionCarriesExecutedWork(declaration, expression, new Set(), nextVisited));
}

function variableCarriesExecutedWork(
  ownerFunction: MorphNode,
  variable: VariableDeclaration,
  visitedVariables: Set<VariableDeclaration>,
  visitedDeclarations: Set<MorphNode>,
): boolean {
  if (visitedVariables.has(variable)) return false;
  const nextVariables = new Set(visitedVariables).add(variable);
  const initializer = variable.getInitializer();
  if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) return false;
  if (initializer && expressionCarriesExecutedWork(
    ownerFunction,
    initializer,
    nextVariables,
    visitedDeclarations,
  )) return true;
  if (initializer && referencedVariables(initializer)
    .some((dependency) => variableCarriesExecutedWork(
      ownerFunction,
      dependency,
      nextVariables,
      visitedDeclarations,
    ))) return true;
  return directCallsIn(ownerFunction)
    .some((call) => callWritesVariable(
      ownerFunction,
      call,
      variable,
      nextVariables,
      visitedDeclarations,
    ));
}

const findingsCarryExecutedWork = (
  evaluation: FunctionDeclaration | ArrowFunction,
  findings: MorphNode,
): boolean => {
  return expressionCarriesExecutedWork(evaluation, findings, new Set(), new Set());
};

const evidenceIsConcrete = (value: MorphNode | null): boolean => {
  if (!value) return false;
  return !Node.isArrayLiteralExpression(value) || value.getElements().length > 0;
};

export const ownerEvaluationExecutesAssertions = (
  evaluation: FunctionDeclaration | ArrowFunction,
): boolean => {
  const result = returnedObject(evaluation);
  if (!result) return false;
  const findings = propertyValue(result, "findings");
  const evidence = propertyValue(result, "inspectedFiles") ?? propertyValue(result, "evidenceRefs");
  return findings !== null
    && findingsCarryExecutedWork(evaluation, findings)
    && evidenceIsConcrete(evidence)
    && evaluation.getDescendantsOfKind(SyntaxKind.CallExpression).length > 0;
};
