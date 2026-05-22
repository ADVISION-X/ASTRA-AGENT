import { Node, SyntaxKind, type CallExpression, type Expression, type Node as MorphNode, type ObjectLiteralExpression } from "ts-morph";

import {
  expressionResolvesToConsoleMethod,
  expressionResolvesToConsoleObject,
  expressionResolvesToRecoveryLogger,
  expressionResolvesToRuntimeEmitCall,
  expressionResolvesToRuntimeLoggerReceiver,
  expressionResolvesToStageHandle,
  expressionResolvesToStageLogger,
  isStageTerminalMethod,
} from "./ast-call-expression-resolvers.js";
import { getStaticMemberName } from "./ast-node-utils.js";
import { isIdentifierBoundTo, isSymbolFromModule, traceDestructuredBinding, traceVariableInitializer, unwrapExpression } from "./ast-symbol-utils.js";

export type ResolvedCall = {
  filePath: string;
  line: number;
  kind:
    | "console-call"
    | "runtime-log-emit"
    | "event-factory"
    | "stage-start"
    | "stage-terminal"
    | "recovery-log"
    | "ai-log"
    | "browser-action-log"
    | "unknown";
  calleeText: string;
  symbolName: string | null;
  objectLiteralArg: ObjectLiteralExpression | undefined;
};

export type AliasIndex = {
  consoleObjects: Set<string>;
  consoleMethods: Set<string>;
  runtimeLoggerObjects: Set<string>;
  runtimeEmitMethods: Set<string>;
  stageLoggerObjects: Set<string>;
  stageHandleObjects: Set<string>;
  stageStartMethods: Set<string>;
  stageTerminalMethods: Set<string>;
  recoveryLoggerObjects: Set<string>;
};

const registerBindingAlias = (index: AliasIndex, bindingName: string, propertyName: string, initializer: Expression | undefined): void => {
  if (expressionResolvesToConsoleObject(initializer, index) && new Set(["log", "error", "warn", "info", "debug"]).has(propertyName)) {
    index.consoleMethods.add(bindingName);
  }
  if (expressionResolvesToRuntimeLoggerReceiver(initializer, index) && propertyName === "emit") {
    index.runtimeEmitMethods.add(bindingName);
  }
  if (expressionResolvesToStageLogger(initializer, index) && propertyName === "start") {
    index.stageStartMethods.add(bindingName);
  }
  if (expressionResolvesToStageHandle(initializer, index) && isStageTerminalMethod(propertyName)) {
    index.stageTerminalMethods.add(bindingName);
  }
};

const registerAliasMatch = (target: Set<string>, name: string, matched: boolean): void => {
  if (matched) {
    target.add(name);
  }
};

export const registerIdentifierAlias = (index: AliasIndex, name: string, initializer: Expression | undefined): void => {
  registerAliasMatch(index.consoleObjects, name, expressionResolvesToConsoleObject(initializer, index));
  registerAliasMatch(index.consoleMethods, name, expressionResolvesToConsoleMethod(initializer, index));
  registerAliasMatch(index.runtimeEmitMethods, name, Boolean(initializer && expressionResolvesToRuntimeEmitCall(initializer, index)));
  registerAliasMatch(index.runtimeLoggerObjects, name, expressionResolvesToRuntimeLoggerReceiver(initializer, index));
  registerAliasMatch(index.stageLoggerObjects, name, expressionResolvesToStageLogger(initializer, index));
  registerAliasMatch(index.stageHandleObjects, name, expressionResolvesToStageHandle(initializer, index));
  registerAliasMatch(index.recoveryLoggerObjects, name, expressionResolvesToRecoveryLogger(initializer, index));
};

export const registerObjectBindingAliases = (index: AliasIndex, declarationName: Node, initializer: Expression | undefined): void => {
  if (!Node.isObjectBindingPattern(declarationName)) {
    return;
  }
  for (const element of declarationName.getElements()) {
    const bindingName = element.getNameNode().getText();
    const propertyName = element.getPropertyNameNode()?.getText() ?? bindingName;
    registerBindingAlias(index, bindingName, propertyName, initializer);
  }
};

const createResolvedCall = (input: {
  filePath: string;
  line: number;
  kind: ResolvedCall["kind"];
  calleeText: string;
  symbolName: string | null;
  objectLiteralArg: ObjectLiteralExpression | undefined;
}): ResolvedCall => input;

type ResolveCallInput = {
  filePath: string;
  line: number;
  expression: Expression;
  calleeText: string;
  objectLiteralArg: ObjectLiteralExpression | undefined;
  index?: AliasIndex;
};

export const resolveConsoleCall = (input: ResolveCallInput): ResolvedCall | null =>
  input.index && expressionResolvesToConsoleMethod(input.expression, input.index)
    ? createResolvedCall({
      ...input,
      kind: "console-call",
      symbolName: getStaticMemberName(input.expression),
    })
    : null;

export const resolveRuntimeEmitCall = (input: ResolveCallInput): ResolvedCall | null =>
  input.index && expressionResolvesToRuntimeEmitCall(input.expression, input.index)
    ? createResolvedCall({
      ...input,
      kind: "runtime-log-emit",
      symbolName: getStaticMemberName(input.expression) ?? "emit",
    })
    : null;

export const resolveEventFactoryCall = (input: ResolveCallInput): ResolvedCall | null => {
  const target = unwrapExpression(input.expression);
  if (!target || !Node.isIdentifier(target)) {
    return null;
  }
  if (target.getText() === "createRuntimeEvent" || isSymbolFromModule(target, "runtime-logs", "createRuntimeEvent") || isSymbolFromModule(target, "event-factory", "createRuntimeEvent")) {
    return createResolvedCall({
      ...input,
      kind: "event-factory",
      symbolName: target.getText(),
    });
  }
  return null;
};

const resolveStageLifecycleIdentifierCall = (input: ResolveCallInput & { index: AliasIndex }): ResolvedCall | null => {
  if (!Node.isIdentifier(input.expression)) {
    return null;
  }
  if (input.index.stageStartMethods.has(input.expression.getText())) {
    return createResolvedCall({ ...input, kind: "stage-start", symbolName: input.expression.getText() });
  }
  if (input.index.stageTerminalMethods.has(input.expression.getText())) {
    return createResolvedCall({ ...input, kind: "stage-terminal", symbolName: input.expression.getText() });
  }
  return null;
};

const resolveStageLifecycleMemberCall = (input: ResolveCallInput & { index: AliasIndex }): ResolvedCall | null => {
  if (!Node.isPropertyAccessExpression(input.expression) && !Node.isElementAccessExpression(input.expression)) {
    return null;
  }
  if (getStaticMemberName(input.expression) === "start" && expressionResolvesToStageLogger(input.expression.getExpression(), input.index)) {
    return createResolvedCall({ ...input, kind: "stage-start", symbolName: "start" });
  }
  if (isStageTerminalMethod(getStaticMemberName(input.expression)) && expressionResolvesToStageHandle(input.expression.getExpression(), input.index)) {
    return createResolvedCall({ ...input, kind: "stage-terminal", symbolName: getStaticMemberName(input.expression) });
  }
  return null;
};

export const resolveStageLifecycleCall = (input: ResolveCallInput): ResolvedCall | null => {
  if (!input.index) {
    return null;
  }
  const indexedInput = { ...input, index: input.index };
  return resolveStageLifecycleIdentifierCall(indexedInput) ?? resolveStageLifecycleMemberCall(indexedInput);
};

export const resolveRecoveryCall = (input: ResolveCallInput): ResolvedCall | null => {
  if (input.index && (Node.isPropertyAccessExpression(input.expression) || Node.isElementAccessExpression(input.expression)) && expressionResolvesToRecoveryLogger(input.expression.getExpression(), input.index)) {
    return createResolvedCall({
      ...input,
      kind: "recovery-log",
      symbolName: getStaticMemberName(input.expression),
    });
  }
  return null;
};

