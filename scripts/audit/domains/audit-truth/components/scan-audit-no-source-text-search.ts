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
  if (expression.getName() !== "getText" && expression.getName() !== "getFullText") {
    return false;
  }
  return expression.getExpression().getType().getSymbol()?.getName() !== "CommentRange";
};

const hasProjectUsage = (sourceFile: SourceFile): boolean =>
  sourceFile
    .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((expression) => expression.getName() === "project" && Node.isIdentifier(expression.getExpression()) && expression.getExpression().getText() === "context");

const textSearchMethods = new Set(["includes", "match", "matchAll", "replace", "replaceAll", "search", "split"]);
const regexArgumentMethods = new Set(["exec", "test"]);
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
  const callName = Node.isIdentifier(expression)
    ? expression.getText()
    : Node.isPropertyAccessExpression(expression)
      ? expression.getName()
      : "";
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
        const receiverSymbol = expression.getExpression().getSymbol();
        const parameterIndex = parameters.findIndex((parameter) =>
          symbolDeclarations(receiverSymbol).some((candidate) => candidate === parameter),
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

const findSourceTextJudgment = (
  sourceFile: SourceFile,
  rawFunctionKeys: ReadonlySet<string>,
  sinkParameters: readonly SinkParameter[],
): string | undefined => {
  const sinkByFunction = new Map<string, Set<number>>();
  for (const sink of sinkParameters) {
    const indexes = sinkByFunction.get(sink.functionKey) ?? new Set<number>();
    indexes.add(sink.parameterIndex);
    sinkByFunction.set(sink.functionKey, indexes);
  }
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
  return undefined;
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

    const sourceTextJudgment = findSourceTextJudgment(sourceFile, rawFunctionKeys, sinkParameters);
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
