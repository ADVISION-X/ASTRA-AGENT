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
import { isAuditTruthScanScopeFile, isOwnerInspectorRepoPath, normalizeAuditTruthPath } from "./audit-truth-scope.js";

const isOwnerInspectorFile = (sourceFile: SourceFile): boolean => isOwnerInspectorRepoPath(getRepoSourcePath(sourceFile));

const isTrackedSourceTextAccess = (expression: PropertyAccessExpression): boolean => {
  return expression.getName() === "getText" || expression.getName() === "getFullText";
};

const hasProjectUsage = (sourceFile: SourceFile): boolean =>
  sourceFile
    .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((expression) => expression.getName() === "project"
      && Node.isIdentifier(expression.getExpression())
      && (expression.getExpression().getSymbol()?.getDeclarations().some((declaration) =>
        Node.isParameterDeclaration(declaration) && declaration.getName() === "context") ?? false));

const textSearchMethods = new Set([
  "endsWith", "includes", "indexOf", "lastIndexOf", "match", "matchAll",
  "replace", "replaceAll", "search", "split", "startsWith",
]);
const regexArgumentMethods = new Set(["exec", "test"]);
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

function identifierUsesRawSource(
  node: import("ts-morph").Identifier,
  rawFunctionKeys: ReadonlySet<string>,
  seenDeclarations: Set<string>,
): boolean {
  for (const declaration of symbolDeclarations(node.getSymbol())) {
    if (!Node.isVariableDeclaration(declaration) && !Node.isParameterDeclaration(declaration)) continue;
    const declarationKey = `${declaration.getSourceFile().getFilePath()}:${declaration.getStart()}`;
    if (seenDeclarations.has(declarationKey)) continue;
    seenDeclarations.add(declarationKey);
    if (Node.isVariableDeclaration(declaration)
      && nodeUsesRawSource(declaration.getInitializer(), rawFunctionKeys, seenDeclarations)) {
      return true;
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
  if (Node.isCallExpression(node)) return callUsesRawSource(node, rawFunctionKeys);
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
      if (!returnedExpressions(declaration).some((expression) => {
        if (Node.isObjectLiteralExpression(expression) || Node.isArrayLiteralExpression(expression)) {
          return false;
        }
        return nodeUsesRawSource(expression, rawFunctionKeys);
      })) {
        continue;
      }
      rawFunctionKeys.add(key);
      changed = true;
    }
  }
  return rawFunctionKeys;
};

type SinkParameter = {
  functionKey: string;
  parameterIndex: number;
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

const collectSinkParameters = (scopeFiles: readonly SourceFile[]): SinkParameter[] => {
  const sinkParameters: SinkParameter[] = [];
  for (const sourceFile of scopeFiles) {
    for (const declaration of sourceFile.getDescendants().filter(Node.isFunctionLikeDeclaration)) {
      const parameters = declaration.getParameters();
      for (const callExpression of declaration.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        const expression = callExpression.getExpression();
        if (!Node.isPropertyAccessExpression(expression) || !textSearchMethods.has(expression.getName())) {
          continue;
        }
        const parameterIndex = parameters.findIndex((parameter) =>
          nodeFlowsFromParameter(expression.getExpression(), parameter),
        );
        if (parameterIndex >= 0) {
          sinkParameters.push({
            functionKey: functionKey(declaration),
            parameterIndex,
          });
        }
      }
    }
  }
  return sinkParameters;
};

const indexSinkParameters = (sinks: readonly SinkParameter[]): Map<string, Set<number>> => {
  const indexed = new Map<string, Set<number>>();
  for (const sink of sinks) {
    const parameters = indexed.get(sink.functionKey) ?? new Set<number>();
    parameters.add(sink.parameterIndex);
    indexed.set(sink.functionKey, parameters);
  }
  return indexed;
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
  sinkParameters: readonly SinkParameter[],
  enforceControlPlaneEquality: boolean,
): string | undefined => {
  const sinkByFunction = indexSinkParameters(sinkParameters);
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
    const calledFunction = resolveCalledFunction(callExpression);
    if (!calledFunction) {
      continue;
    }
    const sinkIndexes = sinkByFunction.get(functionKey(calledFunction));
    if (!sinkIndexes) {
      continue;
    }
    for (const parameterIndex of sinkIndexes) {
      if (nodeUsesRawSource(callExpression.getArguments()[parameterIndex], rawFunctionKeys)) {
        return callExpression.getText();
      }
    }
  }
  return enforceControlPlaneEquality ? findRawEquality(sourceFile, rawFunctionKeys) : undefined;
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
  const sinkParameters = collectSinkParameters(scopeFiles);

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

    const normalizedPath = normalizeAuditTruthPath(repoPath);
    const enforceControlPlaneEquality = normalizedPath.startsWith("scripts/audit/domains/audit-system/")
      || normalizedPath.startsWith("scripts/audit/domains/audit-truth/");
    const sourceTextJudgment = findSourceTextJudgment(
      sourceFile,
      rawFunctionKeys,
      sinkParameters,
      enforceControlPlaneEquality,
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
