import {
  Node,
  SyntaxKind,
  type CallExpression,
  type FunctionLikeDeclaration,
  type Node as MorphNode,
  type PropertyAccessExpression,
  type SourceFile,
  type Symbol as MorphSymbol,
} from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";
import { isAuditTruthScanScopeFile, isOwnerInspectorRepoPath } from "./audit-truth-scope.js";

const isOwnerInspectorFile = (sourceFile: SourceFile): boolean => isOwnerInspectorRepoPath(getRepoSourcePath(sourceFile));

const isTrackedSourceTextAccess = (expression: PropertyAccessExpression): boolean => {
  return expression.getName() === "getText" || expression.getName() === "getFullText";
};

const usageFlowsThroughParent = (parent: MorphNode): boolean =>
  Node.isParenthesizedExpression(parent) || Node.isAwaitExpression(parent)
  || Node.isAsExpression(parent) || Node.isTypeAssertion(parent)
  || Node.isNonNullExpression(parent) || Node.isPropertyAccessExpression(parent)
  || Node.isElementAccessExpression(parent) || Node.isSpreadElement(parent);

const usageTerminatesAtParent = (parent: MorphNode): boolean =>
  Node.isReturnStatement(parent) || Node.isIfStatement(parent)
  || Node.isConditionalExpression(parent) || Node.isForOfStatement(parent)
  || Node.isForInStatement(parent) || Node.isForStatement(parent)
  || Node.isWhileStatement(parent) || Node.isDoStatement(parent)
  || Node.isSwitchStatement(parent) || Node.isBinaryExpression(parent);

const identifierReferencesVariable = (
  identifier: import("ts-morph").Identifier,
  declaration: import("ts-morph").VariableDeclaration,
): boolean => {
  if (identifier.getSymbol()?.getDeclarations().includes(declaration)) return true;
  const parent = identifier.getParent();
  return Node.isShorthandPropertyAssignment(parent)
    && (parent.getValueSymbol()?.getDeclarations().includes(declaration) ?? false);
};

const usageIsConsumed = (node: MorphNode, visited = new Set<string>()): boolean => {
  const key = `${node.getSourceFile().getFilePath()}:${node.getKind()}:${node.getStart()}:${node.getEnd()}`;
  if (visited.has(key)) return false;
  const nextVisited = new Set(visited).add(key);
  const parent = node.getParent();
  if (!parent || Node.isVoidExpression(parent) || Node.isExpressionStatement(parent)) return false;
  if (usageFlowsThroughParent(parent)) {
    return usageIsConsumed(parent, nextVisited);
  }
  if (Node.isVariableDeclaration(parent) && parent.getInitializer() === node) {
    const name = parent.getNameNode();
    if (!Node.isIdentifier(name)) return true;
    return parent.getSourceFile().getDescendantsOfKind(SyntaxKind.Identifier)
      .filter((identifier) => identifier !== name && identifierReferencesVariable(identifier, parent))
      .some((identifier) => usageIsConsumed(identifier, nextVisited));
  }
  if (Node.isCallExpression(parent)) {
    return parent.getArguments().some((argument) => argument === node) || usageIsConsumed(parent, nextVisited);
  }
  if (usageTerminatesAtParent(parent)) return true;
  return usageIsConsumed(parent, nextVisited);
};

const hasProjectUsage = (sourceFile: SourceFile): boolean =>
  sourceFile
    .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((expression) => expression.getName() === "project"
      && Node.isIdentifier(expression.getExpression())
      && (expression.getExpression().getSymbol()?.getDeclarations().some((declaration) =>
        Node.isParameterDeclaration(declaration) && declaration.getName() === "context") ?? false)
      && usageIsConsumed(expression));

const textSearchMethods = new Set([
  "endsWith", "includes", "indexOf", "lastIndexOf", "match", "matchAll",
  "replace", "replaceAll", "search", "split", "startsWith",
]);
const regexArgumentMethods = new Set(["exec", "test"]);
const sourceTextTransformMethods = new Set([
  "normalize", "slice", "substring", "substr", "toLocaleLowerCase", "toLocaleUpperCase",
  "toLowerCase", "toUpperCase", "trim", "trimEnd", "trimStart",
]);
const equalityOperators = new Set([
  SyntaxKind.EqualsEqualsToken,
  SyntaxKind.EqualsEqualsEqualsToken,
  SyntaxKind.ExclamationEqualsToken,
  SyntaxKind.ExclamationEqualsEqualsToken,
]);
type FunctionLikeNode = FunctionLikeDeclaration & MorphNode;

const symbolDeclarations = (symbol: MorphSymbol | undefined): MorphNode[] => {
  if (!symbol) {
    return [];
  }
  const resolved = symbol.getAliasedSymbol() ?? symbol;
  return resolved.getDeclarations();
};

const asFunctionLike = (declaration: MorphNode): FunctionLikeNode | undefined => {
  if (Node.isFunctionLikeDeclaration(declaration)) {
    return declaration;
  }
  if (!Node.isVariableDeclaration(declaration)) {
    return undefined;
  }
  const initializer = declaration.getInitializer();
  return Node.isFunctionLikeDeclaration(initializer) ? initializer : undefined;
};

const functionKey = (declaration: FunctionLikeNode): string =>
  `${declaration.getSourceFile().getFilePath()}:${declaration.getStart()}`;

const resolveCalledFunction = (callExpression: CallExpression): FunctionLikeNode | undefined => {
  for (const declaration of symbolDeclarations(callExpression.getExpression().getSymbol())) {
    const functionLike = asFunctionLike(declaration);
    if (functionLike) {
      return functionLike;
    }
  }
  return undefined;
};

const isRawFileRead = (callExpression: CallExpression): boolean => {
  const expression = callExpression.getExpression();
  const symbol = expression.getSymbol();
  const target = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
  const importedName = symbol?.getDeclarations().flatMap((declaration) =>
    Node.isImportSpecifier(declaration)
      && ["node:fs", "node:fs/promises"].includes(declaration.getImportDeclaration().getModuleSpecifierValue())
      ? [declaration.getName()]
      : [])[0];
  const callName = Node.isPropertyAccessExpression(expression)
    ? expression.getName()
    : importedName ?? target?.getEscapedName().toString() ?? symbol?.getEscapedName().toString() ?? "";
  if (callName !== "readFile" && callName !== "readFileSync") {
    return false;
  }
  return true;
};

const returnedExpressions = (declaration: FunctionLikeNode): MorphNode[] => {
  if (Node.isArrowFunction(declaration)) {
    const body = declaration.getBody();
    if (!Node.isBlock(body)) {
      return [body];
    }
  }
  const expressions: MorphNode[] = [];
  for (const statement of declaration.getDescendantsOfKind(SyntaxKind.ReturnStatement)) {
    if (statement.getFirstAncestor(Node.isFunctionLikeDeclaration) !== declaration) {
      continue;
    }
    const expression = statement.getExpression();
    if (expression) {
      expressions.push(expression);
    }
  }
  return expressions;
};

function callUsesRawSource(
  node: CallExpression,
  rawFunctionKeys: ReadonlySet<string>,
): boolean {
  if (isRawFileRead(node)) return true;
  const callTarget = node.getExpression();
  if (Node.isPropertyAccessExpression(callTarget) && isTrackedSourceTextAccess(callTarget)) return true;
  const calledFunction = resolveCalledFunction(node);
  return Boolean(calledFunction && rawFunctionKeys.has(functionKey(calledFunction)));
}

const collectionMutationValues = (declaration: MorphNode): MorphNode[] => declaration.getSourceFile()
  .getDescendantsOfKind(SyntaxKind.CallExpression)
  .flatMap((call) => {
    const expression = call.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) return [];
    const mutationMethod = expression.getName();
    if (mutationMethod !== "add" && mutationMethod !== "push"
      && mutationMethod !== "set" && mutationMethod !== "unshift") return [];
    const collection = expression.getExpression();
    const declarations = symbolDeclarations(collection.getSymbol());
    return declarations.includes(declaration) ? call.getArguments() : [];
  });

function identifierUsesRawSource(
  node: import("ts-morph").Identifier,
  rawFunctionKeys: ReadonlySet<string>,
  seenDeclarations: Set<string>,
): boolean {
  for (const declaration of symbolDeclarations(node.getSymbol())) {
    if (!Node.isVariableDeclaration(declaration)
      && !Node.isParameterDeclaration(declaration)
      && !Node.isBindingElement(declaration)) continue;
    const declarationKey = `${declaration.getSourceFile().getFilePath()}:${declaration.getStart()}`;
    if (seenDeclarations.has(declarationKey)) continue;
    seenDeclarations.add(declarationKey);
    if (Node.isVariableDeclaration(declaration)
      && nodeUsesRawSource(declaration.getInitializer(), rawFunctionKeys, seenDeclarations)) {
      return true;
    }
    if (Node.isVariableDeclaration(declaration)
      && collectionMutationValues(declaration).some((value) =>
        nodeUsesRawSource(value, rawFunctionKeys, seenDeclarations))) {
      return true;
    }
    if (Node.isBindingElement(declaration)) {
      const variable = declaration.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
      if (nodeUsesRawSource(variable?.getInitializer(), rawFunctionKeys, seenDeclarations)) {
        return true;
      }
    }
  }
  return false;
}

function nodeUsesRawSource(
  node: MorphNode | undefined,
  rawFunctionKeys: ReadonlySet<string>,
  seenDeclarations: Set<string> = new Set<string>(),
): boolean {
  if (!node) return false;
  if (Node.isCallExpression(node)) {
    if (callUsesRawSource(node, rawFunctionKeys)) return true;
    const expression = node.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && sourceTextTransformMethods.has(expression.getName())
      && nodeUsesRawSource(expression.getExpression(), rawFunctionKeys, seenDeclarations);
  }
  if (Node.isPropertyAccessExpression(node) && isTrackedSourceTextAccess(node)) {
    return true;
  }
  if (Node.isPropertyAccessExpression(node) || Node.isElementAccessExpression(node)) {
    return nodeUsesRawSource(node.getExpression(), rawFunctionKeys, seenDeclarations);
  }
  if (Node.isIdentifier(node) && identifierUsesRawSource(node, rawFunctionKeys, seenDeclarations)) return true;
  return node.getChildren().some((child) => nodeUsesRawSource(child, rawFunctionKeys, seenDeclarations));
}

const collectRawSourceFunctions = (scopeFiles: readonly SourceFile[]): Set<string> => {
  const functionLikes = scopeFiles.flatMap((sourceFile) =>
    sourceFile.getDescendants().filter(Node.isFunctionLikeDeclaration),
  );
  const rawFunctionKeys = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const declaration of functionLikes) {
      const key = functionKey(declaration);
      if (rawFunctionKeys.has(key)) {
        continue;
      }
      if (!returnedExpressions(declaration).some((expression) =>
        nodeUsesRawSource(expression, rawFunctionKeys))) {
        continue;
      }
      rawFunctionKeys.add(key);
      changed = true;
    }
  }
  return rawFunctionKeys;
};

const assignedValues = (declaration: MorphNode): MorphNode[] => declaration.getSourceFile()
  .getDescendantsOfKind(SyntaxKind.BinaryExpression)
  .filter((assignment) => assignment.getOperatorToken().getKind() === SyntaxKind.EqualsToken
    && symbolDeclarations(assignment.getLeft().getSymbol()).includes(declaration))
  .map((assignment) => assignment.getRight());

const nodeFlowsFromParameter = (
  node: MorphNode,
  parameter: MorphNode,
  visited: Set<string> = new Set(),
): boolean => {
  const identifiers = [
    ...(Node.isIdentifier(node) ? [node] : []),
    ...node.getDescendantsOfKind(SyntaxKind.Identifier),
  ];
  return identifiers.some((identifier) => symbolDeclarations(identifier.getSymbol()).some((declaration) => {
    if (declaration === parameter) return true;
    const key = `${declaration.getSourceFile().getFilePath()}:${declaration.getStart()}`;
    if (visited.has(key)) return false;
    const nextVisited = new Set(visited).add(key);
    if (Node.isVariableDeclaration(declaration)) {
      const initializer = declaration.getInitializer();
      return (initializer !== undefined && nodeFlowsFromParameter(initializer, parameter, nextVisited))
        || assignedValues(declaration).some((value) => nodeFlowsFromParameter(value, parameter, nextVisited));
    }
    if (Node.isBindingElement(declaration)) {
      const variable = declaration.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
      const initializer = variable?.getInitializer();
      return initializer !== undefined && nodeFlowsFromParameter(initializer, parameter, nextVisited);
    }
    return false;
  }));
};

const parameterFeedsTextSearch = (
  declaration: FunctionLikeNode,
  parameterIndex: number,
  memo: Map<string, boolean>,
  visiting: Set<string> = new Set(),
): boolean => {
  const key = `${functionKey(declaration)}:${parameterIndex}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  if (visiting.has(key)) return false;
  const parameter = declaration.getParameters()[parameterIndex];
  if (!parameter) return false;
  const parameterType = parameter.getType();
  const stringLikeParameter = parameterType.isString() || parameterType.isStringLiteral()
    || parameterType.getUnionTypes().some((member) => member.isString() || member.isStringLiteral());
  if (!stringLikeParameter) {
    memo.set(key, false);
    return false;
  }
  const nextVisiting = new Set(visiting).add(key);
  for (const call of declaration.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = call.getExpression();
    if (Node.isPropertyAccessExpression(expression)
      && textSearchMethods.has(expression.getName())
      && nodeFlowsFromParameter(expression.getExpression(), parameter)) {
      memo.set(key, true);
      return true;
    }
    const nested = resolveCalledFunction(call);
    if (!nested) continue;
    for (const [nestedIndex, argument] of call.getArguments().entries()) {
      if (!nodeFlowsFromParameter(argument, parameter)) continue;
      if (parameterFeedsTextSearch(nested, nestedIndex, memo, nextVisiting)) {
        memo.set(key, true);
        return true;
      }
    }
  }
  memo.set(key, false);
  return false;
};

const findRawEquality = (sourceFile: SourceFile, rawFunctionKeys: ReadonlySet<string>): string | undefined => {
  for (const comparison of sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    if (!equalityOperators.has(comparison.getOperatorToken().getKind())) continue;
    if (nodeUsesRawSource(comparison.getLeft(), rawFunctionKeys)
      || nodeUsesRawSource(comparison.getRight(), rawFunctionKeys)) return comparison.getText();
  }
  return undefined;
};

const findSourceTextJudgment = (
  sourceFile: SourceFile,
  rawFunctionKeys: ReadonlySet<string>,
  sinkMemo: Map<string, boolean>,
): string | undefined => {
  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = callExpression.getExpression();
    if (Node.isPropertyAccessExpression(expression)) {
      const methodName = expression.getName();
      if (
        textSearchMethods.has(methodName)
        && nodeUsesRawSource(expression.getExpression(), rawFunctionKeys)
      ) {
        return callExpression.getText();
      }
      if (
        regexArgumentMethods.has(methodName)
        && nodeUsesRawSource(callExpression.getArguments()[0], rawFunctionKeys)
      ) {
        return callExpression.getText();
      }
    }
    const rawArgumentIndexes = callExpression.getArguments().flatMap((argument, index) =>
      nodeUsesRawSource(argument, rawFunctionKeys) ? [index] : []);
    if (rawArgumentIndexes.length === 0) continue;
    const calledFunction = resolveCalledFunction(callExpression);
    if (!calledFunction) continue;
    if (rawArgumentIndexes.some((parameterIndex) =>
      parameterFeedsTextSearch(calledFunction, parameterIndex, sinkMemo))) {
      return callExpression.getText();
    }
  }
  return findRawEquality(sourceFile, rawFunctionKeys);
};

export const scanAuditNoSourceTextSearch = (input: {
  context: InspectorContext;
  inspectedFiles: Set<string>;
  lawId: string;
}): { findings: InspectorFinding[]; inspectorFileCount: number } => {
  const findings: InspectorFinding[] = [];
  const scopeFiles = input.context.project
    .getSourceFiles()
    .filter((sourceFile) => !sourceFile.isDeclarationFile() && isAuditTruthScanScopeFile(sourceFile));
  const inspectorFiles = scopeFiles.filter((sourceFile) => isOwnerInspectorFile(sourceFile));
  const rawFunctionKeys = collectRawSourceFunctions(scopeFiles);
  const sinkMemo = new Map<string, boolean>();

  for (const sourceFile of scopeFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    input.inspectedFiles.add(repoPath);
    if (isOwnerInspectorFile(sourceFile) && !hasProjectUsage(sourceFile)) {
      findings.push(
        createFinding({
          checkId: "audit-truth/inspector-project-usage",
          lawId: input.lawId,
          filePath: repoPath,
          message: `${repoPath} does not use context.project and cannot prove AST-first enforcement.`,
        }),
      );
    }

    const sourceTextJudgment = findSourceTextJudgment(
      sourceFile,
      rawFunctionKeys,
      sinkMemo,
    );
    if (!sourceTextJudgment) {
      continue;
    }
    findings.push(
      createFinding({
        checkId: "audit-truth/source-text-judgment",
        lawId: input.lawId,
        filePath: repoPath,
        message: `${repoPath} uses source-text judgment ${sourceTextJudgment} on tracked ts-morph text.`,
      }),
    );
  }

  return {
    findings,
    inspectorFileCount: inspectorFiles.length,
  };
};
