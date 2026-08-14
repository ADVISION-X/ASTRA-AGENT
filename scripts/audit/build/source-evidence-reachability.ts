import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type FunctionDeclaration,
  type FunctionExpression,
  type MethodDeclaration,
  type Node as MorphNode,
  type Project,
  type VariableDeclaration,
} from "ts-morph";

import type { ManifestSource } from "../shared/manifest-contracts.js";
import { resolveFromRepo } from "../shared/paths.js";

type FunctionNode = FunctionDeclaration | MethodDeclaration | ArrowFunction | FunctionExpression;

const functionNodeFor = (declaration: MorphNode): FunctionNode | null => {
  if (Node.isFunctionDeclaration(declaration) || Node.isMethodDeclaration(declaration)
    || Node.isArrowFunction(declaration) || Node.isFunctionExpression(declaration)) return declaration;
  if (!Node.isVariableDeclaration(declaration)) return null;
  const initializer = declaration.getInitializer();
  return initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))
    ? initializer
    : null;
};

const declarationKey = (declaration: MorphNode): string => {
  const canonical = functionNodeFor(declaration) ?? declaration;
  return `${canonical.getSourceFile().getFilePath()}:${canonical.getStart()}`;
};

const exportedDeclarations = (
  project: Project,
  filePath: string,
  symbolName: string,
): MorphNode[] => project.getSourceFile(resolveFromRepo(filePath))
  ?.getExportedDeclarations().get(symbolName) ?? [];

export const ownerAssertionRoots = (project: Project, manifest: ManifestSource): MorphNode[] => {
  const inspector = project.getSourceFile(resolveFromRepo(manifest.ownerInspectorPath));
  const inspectDomain = inspector?.getFunction("inspectDomain")
    ?? inspector?.getVariableDeclaration("inspectDomain")?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const contextParameter = inspectDomain?.getParameters()[0];
  if (!inspectDomain || !contextParameter) return [];
  const signedCallbacks = inspectDomain.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
    const callee = call.getExpression();
    if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== "runAll") return [];
    const checks = callee.getExpression();
    const receiver = Node.isPropertyAccessExpression(checks) && checks.getName() === "checks"
      ? checks.getExpression()
      : undefined;
    const callback = call.getArguments()[0];
    const isSignedCall = (receiver?.getSymbol()?.getDeclarations().includes(contextParameter) ?? false)
      && call.getFirstAncestor(Node.isFunctionLikeDeclaration) === inspectDomain
      && Node.isAwaitExpression(call.getParent())
      && callback !== undefined
      && (Node.isArrowFunction(callback) || Node.isFunctionExpression(callback));
    return isSignedCall ? [callback] : [];
  });
  return signedCallbacks.length === 1 ? [inspectDomain, signedCallbacks[0]!] : [];
};

const callDeclarations = (call: MorphNode): MorphNode[] => {
  if (!Node.isCallExpression(call)) return [];
  const symbol = call.getExpression().getSymbol();
  const resolved = symbol?.getAliasedSymbol() ?? symbol;
  return (resolved?.getDeclarations() ?? [])
    .filter((declaration) => !declaration.getSourceFile().isDeclarationFile());
};

const returnedExpressions = (declaration: MorphNode): MorphNode[] => {
  const functionNode = functionNodeFor(declaration);
  if (!functionNode) return [];
  const body = functionNode.getBody();
  if (!body) return [];
  if (Node.isArrowFunction(functionNode) && !Node.isBlock(body)) return [body];
  return body.getDescendantsOfKind(SyntaxKind.ReturnStatement)
    .filter((statement) => statement.getFirstAncestor(Node.isFunctionLikeDeclaration) === functionNode)
    .flatMap((statement) => statement.getExpression() ? [statement.getExpression()!] : []);
};

const variableDeclarations = (node: MorphNode): VariableDeclaration[] => {
  const identifiers = [
    ...(Node.isIdentifier(node) ? [node] : []),
    ...node.getDescendantsOfKind(SyntaxKind.Identifier),
  ];
  return [...new Set(identifiers.flatMap((identifier) => {
    const parent = identifier.getParent();
    const symbol = Node.isShorthandPropertyAssignment(parent) && parent.getNameNode() === identifier
      ? parent.getValueSymbol()
      : identifier.getSymbol();
    return symbol?.getDeclarations().filter(Node.isVariableDeclaration) ?? [];
  }))];
};

const callDirectlyTargets = (call: MorphNode, targetKeys: ReadonlySet<string>): boolean =>
  callDeclarations(call).some((declaration) => targetKeys.has(declarationKey(declaration)));

const transparentInner = (expression: MorphNode): MorphNode | undefined => {
  if (Node.isParenthesizedExpression(expression) || Node.isAwaitExpression(expression)
    || Node.isAsExpression(expression) || Node.isTypeAssertion(expression)
    || Node.isNonNullExpression(expression) || Node.isSpreadElement(expression)
    || Node.isPropertyAccessExpression(expression) || Node.isElementAccessExpression(expression)) {
    return expression.getExpression();
  }
  return undefined;
};

const compositeChildren = (expression: MorphNode): MorphNode[] | undefined => {
  if (Node.isConditionalExpression(expression)) return [expression.getWhenTrue(), expression.getWhenFalse()];
  if (Node.isArrayLiteralExpression(expression)) return [...expression.getElements()];
  if (Node.isObjectLiteralExpression(expression)) return [...expression.getProperties()];
  if (Node.isPropertyAssignment(expression)) {
    const initializer = expression.getInitializer();
    return initializer ? [initializer] : [];
  }
  if (Node.isShorthandPropertyAssignment(expression)) return [expression.getNameNode()];
  return undefined;
};

function expressionCarriesSourceEvidence(
  boundary: FunctionNode,
  expression: MorphNode | undefined,
  targetKeys: ReadonlySet<string>,
  visitedVariables = new Set<string>(),
  visitedFunctions = new Set<string>(),
): boolean {
  if (!expression) return false;
  const inner = transparentInner(expression);
  if (inner) return expressionCarriesSourceEvidence(boundary, inner, targetKeys, visitedVariables, visitedFunctions);
  const children = compositeChildren(expression);
  if (children) {
    return children.some((child) =>
      expressionCarriesSourceEvidence(boundary, child, targetKeys, visitedVariables, visitedFunctions));
  }
  if (Node.isCallExpression(expression)
    && callCarriesSourceEvidence(expression, targetKeys, visitedFunctions)) return true;
  return variableDeclarations(expression).some((variable) => variableCarriesSourceEvidence(
    boundary,
    variable,
    targetKeys,
    visitedVariables,
    visitedFunctions,
  ));
}

const callCarriesSourceEvidence = (
  call: MorphNode,
  targetKeys: ReadonlySet<string>,
  visitedFunctions: ReadonlySet<string>,
): boolean => {
  if (callDirectlyTargets(call, targetKeys)) return true;
  return callDeclarations(call).some((declaration) => {
    const functionNode = functionNodeFor(declaration);
    if (!functionNode) return false;
    const key = declarationKey(functionNode);
    if (visitedFunctions.has(key)) return false;
    const nextFunctions = new Set(visitedFunctions).add(key);
    return returnedExpressions(functionNode).some((returned) =>
      expressionCarriesSourceEvidence(functionNode, returned, targetKeys, new Set(), nextFunctions));
  });
};

const variableReceivesSourceEvidence = (
  boundary: FunctionNode,
  variable: VariableDeclaration,
  targetKeys: ReadonlySet<string>,
  visitedVariables: ReadonlySet<string>,
  visitedFunctions: ReadonlySet<string>,
): boolean => boundary.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
  if (call.getFirstAncestor(Node.isFunctionLikeDeclaration) !== boundary) return false;
  const callee = call.getExpression();
  const directPush = Node.isPropertyAccessExpression(callee)
    && callee.getName() === "push"
    && variableDeclarations(callee.getExpression()).includes(variable)
    && call.getArguments().some((argument) => expressionCarriesSourceEvidence(
      boundary,
      argument,
      targetKeys,
      new Set(visitedVariables),
      new Set(visitedFunctions),
    ));
  if (directPush) return true;
  return call.getArguments().some((argument, index) =>
    variableDeclarations(argument).includes(variable)
    && callDeclarations(call).some((declaration) => {
      const functionNode = functionNodeFor(declaration);
      const parameter = functionNode?.getParameters()[index];
      return functionNode !== null && functionNode !== undefined && parameter !== undefined
        && parameterReceivesSourceEvidence(functionNode, parameter, targetKeys, new Set());
    }));
});

const variableCarriesSourceEvidence = (
  boundary: FunctionNode,
  variable: VariableDeclaration,
  targetKeys: ReadonlySet<string>,
  visitedVariables: ReadonlySet<string>,
  visitedFunctions: ReadonlySet<string>,
): boolean => {
  const key = declarationKey(variable);
  if (visitedVariables.has(key)) return false;
  const nextVariables = new Set(visitedVariables).add(key);
  return expressionCarriesSourceEvidence(
    boundary,
    variable.getInitializer(),
    targetKeys,
    nextVariables,
    new Set(visitedFunctions),
  ) || variableReceivesSourceEvidence(
    boundary,
    variable,
    targetKeys,
    nextVariables,
    visitedFunctions,
  );
};

const nodeReferencesParameter = (node: MorphNode, parameter: MorphNode): boolean => {
  const identifiers = [
    ...(Node.isIdentifier(node) ? [node] : []),
    ...node.getDescendantsOfKind(SyntaxKind.Identifier),
  ];
  return identifiers.some((identifier) => identifier.getSymbol()?.getDeclarations().includes(parameter) ?? false);
};

function parameterReceivesSourceEvidence(
  functionNode: FunctionNode,
  parameter: MorphNode,
  targetKeys: ReadonlySet<string>,
  visited: Set<string>,
): boolean {
  const visitKey = `${declarationKey(functionNode)}:${parameter.getStart()}`;
  if (visited.has(visitKey)) return false;
  const nextVisited = new Set(visited).add(visitKey);
  return functionNode.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    if (call.getFirstAncestor(Node.isFunctionLikeDeclaration) !== functionNode) return false;
    const callee = call.getExpression();
    if (Node.isPropertyAccessExpression(callee)
      && callee.getName() === "push"
      && nodeReferencesParameter(callee.getExpression(), parameter)
      && call.getArguments().some((argument) => expressionCarriesSourceEvidence(
        functionNode,
        argument,
        targetKeys,
      ))) return true;
    return call.getArguments().some((argument, index) =>
      nodeReferencesParameter(argument, parameter)
      && callDeclarations(call).some((declaration) => {
        const nestedFunction = functionNodeFor(declaration);
        const nestedParameter = nestedFunction?.getParameters()[index];
        return nestedFunction !== null && nestedFunction !== undefined && nestedParameter !== undefined
          && parameterReceivesSourceEvidence(nestedFunction, nestedParameter, targetKeys, nextVisited);
      }));
  });
}

const ownerFindingsCarrySourceEvidence = (
  callback: MorphNode,
  targetKeys: ReadonlySet<string>,
): boolean => {
  const functionNode = functionNodeFor(callback);
  if (!functionNode) return false;
  return returnedExpressions(functionNode).some((expression) => {
    if (!Node.isObjectLiteralExpression(expression)) return false;
    const property = expression.getProperty("findings");
    const findings = Node.isPropertyAssignment(property)
      ? property.getInitializer()
      : Node.isShorthandPropertyAssignment(property) ? property.getNameNode() : undefined;
    return expressionCarriesSourceEvidence(functionNode, findings, targetKeys);
  });
};

const sourceEvidenceProducesFinding = (
  project: Project,
  declarations: readonly MorphNode[],
): boolean => {
  const findingTargets = new Set(
    exportedDeclarations(project, "scripts/audit/shared/finding-utils.ts", "createFinding").map(declarationKey),
  );
  if (findingTargets.size === 0) return false;
  return declarations.some((declaration) => {
    const functionNode = functionNodeFor(declaration);
    return functionNode !== null && returnedExpressions(functionNode).some((expression) =>
      expressionCarriesSourceEvidence(functionNode, expression, findingTargets));
  });
};

export const sourceEvidenceIsReachable = (
  project: Project,
  manifest: ManifestSource,
  filePath: string,
  symbolName: string,
): boolean => {
  const targetDeclarations = exportedDeclarations(project, filePath, symbolName);
  const targets = new Set(targetDeclarations.map(declarationKey));
  if (targets.size === 0) return false;
  const roots = ownerAssertionRoots(project, manifest);
  if (roots.length !== 2) return false;
  if (targets.has(declarationKey(roots[0]!))) return true;
  return sourceEvidenceProducesFinding(project, targetDeclarations)
    && ownerFindingsCarrySourceEvidence(roots[1]!, targets);
};
