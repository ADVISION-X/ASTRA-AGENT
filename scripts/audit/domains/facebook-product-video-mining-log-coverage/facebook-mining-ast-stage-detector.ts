import { Node, SyntaxKind, type CallExpression, type Expression, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { getRepoSourcePath } from "../../shared/source-files.js";
import { resolveCallsInSourceFile } from "../runtime-log-spine/ast/ast-call-resolver.js";
import {
  getPropertyInitializer,
  getStringLiteralProperty,
} from "../runtime-log-spine/ast/ast-object-literal-reader.js";
import { resolveObjectLiteralExpression } from "../runtime-log-spine/ast/ast-object-literal-resolver.js";

type ResolvedCall = ReturnType<typeof resolveCallsInSourceFile>[number];

export type FacebookStageCoverageSite = {
  file: string;
  line: number;
  method: "start" | "complete" | "fail" | "skip" | "reviewRequired";
};

type SemanticStageSite = FacebookStageCoverageSite & {
  objectLiteral: ObjectLiteralExpression | null;
  semanticText: string;
};

const buildResolvedCallKey = (resolvedCall: ResolvedCall): string => `${resolvedCall.line}:${resolvedCall.calleeText}`;

const buildCallQueues = (sourceFile: SourceFile): Map<string, CallExpression[]> => {
  const queues = new Map<string, CallExpression[]>();
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const key = `${call.getStartLineNumber()}:${call.getExpression().getText()}`;
    queues.set(key, [...(queues.get(key) ?? []), call]);
  }
  return queues;
};

const consumeCallNode = (queues: Map<string, CallExpression[]>, resolvedCall: ResolvedCall): CallExpression | null => {
  const key = buildResolvedCallKey(resolvedCall);
  const queue = queues.get(key);
  if (!queue || queue.length === 0) {
    return null;
  }
  return queue.shift() ?? null;
};

const buildSeenKey = (target: Node | Expression): string => `${target.getSourceFile().getFilePath()}:${target.getStart()}`;

const collectObjectLiteralTexts = (target: ObjectLiteralExpression, seen: Set<string>): string[] => {
  const texts = [target.getText()];
  for (const property of target.getProperties()) {
    if (Node.isPropertyAssignment(property)) {
      texts.push(property.getName());
      texts.push(...collectExpressionSemanticTexts(property.getInitializer(), seen));
      continue;
    }
    if (Node.isShorthandPropertyAssignment(property)) {
      texts.push(property.getName());
      texts.push(...collectExpressionSemanticTexts(property.getNameNode(), seen));
      continue;
    }
    if (Node.isSpreadAssignment(property)) {
      texts.push(...collectExpressionSemanticTexts(property.getExpression(), seen));
    }
  }
  return texts;
};

const collectResolvedIdentifierTexts = (target: Expression, seen: Set<string>): string[] => {
  const resolved = resolveObjectLiteralExpression(target);
  return resolved ? [target.getText(), ...collectExpressionSemanticTexts(resolved, seen)] : [target.getText()];
};

const collectPropertyAccessTexts = (target: Expression, propertyName: string, seen: Set<string>): string[] => {
  const sourceObject = resolveObjectLiteralExpression(target);
  return sourceObject
    ? collectExpressionSemanticTexts(getPropertyInitializer(sourceObject, propertyName), seen)
    : [];
};

const collectArrayTexts = (target: Expression, seen: Set<string>): string[] => {
  if (!Node.isArrayLiteralExpression(target)) {
    return [];
  }
  return target.getElements().flatMap((element) =>
    collectExpressionSemanticTexts(Node.isSpreadElement(element) ? element.getExpression() : element, seen),
  );
};

const collectExpressionSemanticTexts = (
  node: Node | Expression | null | undefined,
  seen = new Set<string>(),
): string[] => {
  const target = node ? node : null;
  if (!target) {
    return [];
  }
  const key = buildSeenKey(target);
  if (seen.has(key)) {
    return [];
  }
  seen.add(key);
  if (Node.isObjectLiteralExpression(target)) {
    return collectObjectLiteralTexts(target, seen);
  }
  if (Node.isIdentifier(target) || Node.isCallExpression(target)) {
    return collectResolvedIdentifierTexts(target as Expression, seen);
  }
  if (Node.isPropertyAccessExpression(target)) {
    return [target.getText(), ...collectPropertyAccessTexts(target.getExpression(), target.getName(), seen)];
  }
  if (Node.isElementAccessExpression(target)) {
    const argument = target.getArgumentExpression();
    const propertyName = Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument)
      ? argument.getLiteralValue()
      : null;
    return propertyName
      ? [target.getText(), ...collectPropertyAccessTexts(target.getExpression(), propertyName, seen)]
      : [target.getText()];
  }
  return Node.isArrayLiteralExpression(target) ? collectArrayTexts(target, seen) : [target.getText()];
};

const resolveStageHandleName = (call: CallExpression): string | null => {
  const expression = call.getExpression();
  if (!Node.isPropertyAccessExpression(expression) && !Node.isElementAccessExpression(expression)) {
    return null;
  }
  const receiver = expression.getExpression();
  return Node.isIdentifier(receiver) ? receiver.getText() : null;
};

const resolveStageHandleBinding = (call: CallExpression): string | null => {
  const variableDeclaration = call.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (!variableDeclaration || variableDeclaration.getInitializer() !== call) {
    return null;
  }
  const nameNode = variableDeclaration.getNameNode();
  return Node.isIdentifier(nameNode) ? nameNode.getText() : null;
};

const resolveFirstArgObjectLiteral = (call: CallExpression): ObjectLiteralExpression | null => {
  const firstArg = call.getArguments()[0];
  if (!firstArg) {
    return null;
  }
  return resolveObjectLiteralExpression(firstArg as Expression);
};

const buildSemanticStageSite = (input: {
  file: string;
  line: number;
  method: SemanticStageSite["method"];
  objectLiteral: ObjectLiteralExpression | null;
}): SemanticStageSite => ({
  file: input.file,
  line: input.line,
  method: input.method,
  objectLiteral: input.objectLiteral,
  semanticText: input.objectLiteral ? collectExpressionSemanticTexts(input.objectLiteral).join("\n") : "",
});

const buildTerminalMethod = (symbolName: string | null): SemanticStageSite["method"] => {
  if (symbolName === "fail") return "fail";
  if (symbolName === "skip") return "skip";
  if (symbolName === "reviewRequired") return "reviewRequired";
  return "complete";
};

const buildCoverageTokenSet = (sites: readonly SemanticStageSite[]): Set<string> =>
  new Set(sites.flatMap((site) => site.semanticText.length > 0 ? [site.semanticText] : []));

const hasSemanticToken = (sites: readonly SemanticStageSite[], token: string): boolean =>
  buildCoverageTokenSet(sites).size > 0
    && [...buildCoverageTokenSet(sites)].some((text) => text.includes(token));

export const collectSemanticFacebookStageSites = (sourceFiles: readonly SourceFile[]): {
  startSitesByStage: Map<string, SemanticStageSite[]>;
  terminalSitesByStage: Map<string, SemanticStageSite[]>;
} => {
  const startSitesByStage = new Map<string, SemanticStageSite[]>();
  const terminalSitesByStage = new Map<string, SemanticStageSite[]>();

  for (const sourceFile of sourceFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    const callQueues = buildCallQueues(sourceFile);
    const handleToStageName = new Map<string, string>();
    const resolvedStageCalls = resolveCallsInSourceFile(sourceFile, repoPath)
      .filter((resolvedCall) => resolvedCall.kind === "stage-start" || resolvedCall.kind === "stage-terminal")
      .flatMap((resolvedCall) => {
        const callNode = consumeCallNode(callQueues, resolvedCall);
        return callNode ? [{ resolvedCall, callNode }] : [];
      });

    for (const { resolvedCall, callNode } of resolvedStageCalls) {
      if (resolvedCall.kind !== "stage-start") {
        continue;
      }
      const objectLiteral = resolvedCall.objectLiteralArg ?? resolveFirstArgObjectLiteral(callNode);
      const stageName = objectLiteral ? getStringLiteralProperty(objectLiteral, "stageName") : null;
      if (!stageName) {
        continue;
      }
      const startSite = buildSemanticStageSite({ file: repoPath, line: resolvedCall.line, method: "start", objectLiteral });
      startSitesByStage.set(stageName, [...(startSitesByStage.get(stageName) ?? []), startSite]);
      const handleName = resolveStageHandleBinding(callNode);
      if (handleName) {
        handleToStageName.set(handleName, stageName);
      }
    }

    for (const { resolvedCall, callNode } of resolvedStageCalls) {
      if (resolvedCall.kind !== "stage-terminal") {
        continue;
      }
      const handleName = resolveStageHandleName(callNode);
      const stageName = handleName ? handleToStageName.get(handleName) : undefined;
      if (!stageName) {
        continue;
      }
      const terminalSite = buildSemanticStageSite({
        file: repoPath,
        line: resolvedCall.line,
        method: buildTerminalMethod(resolvedCall.symbolName),
        objectLiteral: resolveFirstArgObjectLiteral(callNode),
      });
      terminalSitesByStage.set(stageName, [...(terminalSitesByStage.get(stageName) ?? []), terminalSite]);
    }
  }

  return { startSitesByStage, terminalSitesByStage };
};

export const hasRequiredVisibility = (
  sites: readonly SemanticStageSite[],
  visibility: "FLOW" | "DEBUG" | "TRACE",
): boolean => sites.some((site) => site.semanticText.includes(visibility));

export const hasRequiredSemanticToken = (sites: readonly SemanticStageSite[], token: string): boolean =>
  hasSemanticToken(sites, token);
