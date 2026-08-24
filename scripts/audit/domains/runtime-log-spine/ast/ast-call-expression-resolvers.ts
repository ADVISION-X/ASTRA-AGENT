import { Node, type Expression, type Node as MorphNode } from "ts-morph";

import { astExpressionPath, astIdentifierName } from "../../../shared/ast-node-identity.js";
import { getStaticMemberName } from "./ast-node-utils.js";
import type { AliasIndex } from "./ast-call-resolver-support.js";
import {
  isIdentifierBoundTo,
  isSymbolFromModule,
  traceDestructuredBinding,
  traceVariableInitializer,
  unwrapExpression,
} from "./ast-symbol-utils.js";

const MAX_TRACE_DEPTH = 8;
const consoleMethods = new Set(["log", "error", "warn", "info", "debug"]);
const consoleObjectTexts = new Set(["console", "globalThis.console", "window.console", "global.console"]);
const runtimeLoggerNames = new Set(["logger", "runtimeLogger"]);
const stageTerminalMethods = new Set(["complete", "fail", "skip", "reviewRequired"]);

const toExpression = (node: MorphNode | null): Expression | null => {
  if (!node || Node.isImportSpecifier(node) || Node.isImportClause(node) || Node.isNamespaceImport(node)) {
    return null;
  }
  return node as Expression;
};

const traceExpression = (expression: Expression | undefined, depth = 0): Expression | null => {
  const target = toExpression(unwrapExpression(expression));
  if (!target || depth > MAX_TRACE_DEPTH) {
    return null;
  }
  if (!Node.isIdentifier(target)) {
    return target;
  }
  const traced = traceVariableInitializer(target, depth + 1) ?? traceDestructuredBinding(target, depth + 1);
  if (!traced || traced === target) {
    return target;
  }
  return traceExpression(toExpression(traced) ?? undefined, depth + 1) ?? toExpression(traced);
};

const isCallToImportedName = (expression: Expression, exportName: string, moduleFragment: string): boolean => {
  const target = unwrapExpression(expression);
  return Boolean(target && Node.isIdentifier(target) && isSymbolFromModule(target, moduleFragment, exportName));
};

export const expressionResolvesToConsoleObject = (expression: Expression | undefined, index: AliasIndex, depth = 0): boolean => {
  const target = traceExpression(expression, depth);
  if (!target || depth > MAX_TRACE_DEPTH) {
    return false;
  }
  if (Node.isIdentifier(target)) {
    const name = astIdentifierName(target) ?? "";
    return consoleObjectTexts.has(name) || index.consoleObjects.has(name);
  }
  if (Node.isPropertyAccessExpression(target)) {
    return consoleObjectTexts.has(astExpressionPath(target) ?? "")
      || (target.getName() === "console" && expressionResolvesToConsoleObject(target.getExpression(), index, depth + 1));
  }
  return consoleObjectTexts.has(astExpressionPath(target) ?? "");
};

const resolveConsoleMethodIdentifier = (target: Expression, index: AliasIndex, depth: number): boolean => {
  if (!Node.isIdentifier(target)) {
    return false;
  }
  if (index.consoleMethods.has(astIdentifierName(target) ?? "")) {
    return true;
  }
  const traced = traceVariableInitializer(target, depth + 1) ?? traceDestructuredBinding(target, depth + 1);
  return traced ? expressionResolvesToConsoleMethod(toExpression(traced) ?? undefined, index, depth + 1) : false;
};

export const expressionResolvesToConsoleMethod = (expression: Expression | undefined, index: AliasIndex, depth = 0): boolean => {
  const target = traceExpression(expression, depth);
  if (!target || depth > MAX_TRACE_DEPTH) {
    return false;
  }
  if (resolveConsoleMethodIdentifier(target, index, depth)) {
    return true;
  }
  if (Node.isPropertyAccessExpression(target)) {
    return consoleMethods.has(target.getName()) && expressionResolvesToConsoleObject(target.getExpression(), index, depth + 1);
  }
  if (Node.isElementAccessExpression(target)) {
    return expressionResolvesToConsoleObject(target.getExpression(), index, depth + 1);
  }
  return false;
};

export const expressionResolvesToRuntimeLoggerReceiver = (expression: Expression | undefined, index: AliasIndex, depth = 0): boolean => {
  const target = traceExpression(expression, depth);
  if (!target || depth > MAX_TRACE_DEPTH) {
    return false;
  }
  if (Node.isIdentifier(target)) {
    const name = astIdentifierName(target) ?? "";
    return runtimeLoggerNames.has(name)
      || index.runtimeLoggerObjects.has(name)
      || isIdentifierBoundTo(target, "RuntimeLogger");
  }
  if (Node.isCallExpression(target)) {
    return isCallToImportedName(target.getExpression(), "createRuntimeLogger", "runtime-logs");
  }
  if (Node.isPropertyAccessExpression(target)) {
    return runtimeLoggerNames.has(target.getName()) || target.getName() === "logger" || target.getName() === "runtimeLogger";
  }
  return false;
};

export const expressionResolvesToStageLogger = (expression: Expression | undefined, index: AliasIndex, depth = 0): boolean => {
  const target = traceExpression(expression, depth);
  if (!target || depth > MAX_TRACE_DEPTH) {
    return false;
  }
  if (Node.isIdentifier(target)) {
    const name = astIdentifierName(target);
    return name === "stageLogger" || index.stageLoggerObjects.has(name ?? "");
  }
  if (Node.isCallExpression(target)) {
    return isCallToImportedName(target.getExpression(), "createStageLogger", "runtime-logs")
      || isCallToImportedName(target.getExpression(), "createStageLogger", "stage-logger");
  }
  return Node.isPropertyAccessExpression(target) && target.getName() === "stageLogger";
};

const resolveStageHandleIdentifier = (target: Expression, index: AliasIndex, depth: number): boolean => {
  if (!Node.isIdentifier(target)) {
    return false;
  }
  if (index.stageHandleObjects.has(astIdentifierName(target) ?? "")) {
    return true;
  }
  const traced = traceVariableInitializer(target, depth + 1) ?? traceDestructuredBinding(target, depth + 1);
  return traced ? expressionResolvesToStageHandle(toExpression(traced) ?? undefined, index, depth + 1) : false;
};

export const expressionResolvesToStageHandle = (expression: Expression | undefined, index: AliasIndex, depth = 0): boolean => {
  const target = traceExpression(expression, depth);
  if (!target || depth > MAX_TRACE_DEPTH) {
    return false;
  }
  if (resolveStageHandleIdentifier(target, index, depth)) {
    return true;
  }
  if (!Node.isCallExpression(target)) {
    return false;
  }
  const callee = target.getExpression();
  if (!Node.isPropertyAccessExpression(callee) && !Node.isElementAccessExpression(callee)) {
    return false;
  }
  return getStaticMemberName(callee) === "start" && expressionResolvesToStageLogger(callee.getExpression(), index, depth + 1);
};

export const expressionResolvesToRecoveryLogger = (expression: Expression | undefined, index: AliasIndex, depth = 0): boolean => {
  const target = traceExpression(expression, depth);
  if (!target || depth > MAX_TRACE_DEPTH) {
    return false;
  }
  if (Node.isIdentifier(target)) {
    const name = astIdentifierName(target);
    return name === "recoveryLogger" || index.recoveryLoggerObjects.has(name ?? "");
  }
  return Node.isPropertyAccessExpression(target) && target.getName() === "recoveryLogger";
};

export const expressionResolvesToRuntimeEmitCall = (expression: Expression, index: AliasIndex, depth = 0): boolean => {
  const target = traceExpression(expression, depth);
  if (!target || depth > MAX_TRACE_DEPTH) {
    return false;
  }
  if (Node.isIdentifier(target)) {
    return index.runtimeEmitMethods.has(astIdentifierName(target) ?? "");
  }
  if (Node.isPropertyAccessExpression(target) || Node.isElementAccessExpression(target)) {
    return (getStaticMemberName(target) === "emit" || Node.isElementAccessExpression(target))
      && expressionResolvesToRuntimeLoggerReceiver(target.getExpression(), index, depth + 1);
  }
  return false;
};

export const isStageTerminalMethod = (name: string | null): boolean => stageTerminalMethods.has(name ?? "");
