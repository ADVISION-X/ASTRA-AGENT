import {
  Node,
  type Expression,
  type Identifier,
  type Node as MorphNode,
  type ObjectLiteralExpression,
} from "ts-morph";

import { containsAny } from "../../../shared/no-regex.js";
import { resolveObjectLiteralExpression } from "./ast-object-literal-resolver.js";
import { traceDestructuredBinding, traceImportedBinding, traceVariableInitializer, unwrapExpression } from "./ast-symbol-utils.js";

const MAX_TRACE_DEPTH = 8;

const getNamedProperty = (objectLiteral: ObjectLiteralExpression, propertyName: string) =>
  objectLiteral.getProperties().find((property) => {
    if (!Node.isPropertyAssignment(property) && !Node.isShorthandPropertyAssignment(property)) {
      return false;
    }
    return property.getName() === propertyName;
  }) ?? undefined;

const toExpression = (node: MorphNode | null): Expression | null => {
  if (!node || Node.isImportSpecifier(node) || Node.isImportClause(node) || Node.isNamespaceImport(node)) {
    return null;
  }
  return node as Expression;
};

const listSpreadObjectLiterals = (objectLiteral: ObjectLiteralExpression): ObjectLiteralExpression[] =>
  objectLiteral.getProperties().flatMap((property) => {
    if (!Node.isSpreadAssignment(property)) {
      return [];
    }
    const resolved = resolveObjectLiteralExpression(property.getExpression());
    return resolved ? [resolved] : [];
  });

const getStringLiteralValue = (node: MorphNode | null, depth = 0): string | null => {
  const target = unwrapExpression(node);
  if (!target || depth > MAX_TRACE_DEPTH) {
    return null;
  }
  if (Node.isStringLiteral(target) || Node.isNoSubstitutionTemplateLiteral(target)) {
    return target.getLiteralValue();
  }
  if (Node.isIdentifier(target)) {
    const traced = traceVariableInitializer(target, depth + 1) ?? traceDestructuredBinding(target, depth + 1);
    return getStringLiteralValue(traced, depth + 1);
  }
  return null;
};

const matchesRuntimeLogEventTypeImport = (identifier: Identifier): boolean => {
  const imported = traceImportedBinding(identifier);
  if (!imported) {
    return false;
  }
  const moduleSpecifier = imported.getModuleSpecifierValue();
  return containsAny(moduleSpecifier, ["runtime-logs"])
    && imported.getNamedImports().some((item) => {
      const importName = item.getNameNode().getText();
      const aliasName = item.getAliasNode()?.getText() ?? importName;
      return importName === "RuntimeLogEventType" && aliasName === identifier.getText();
    });
};

const isRuntimeLogEventTypeSourceIdentifier = (identifier: Identifier): boolean =>
  identifier.getSourceFile().getFilePath().endsWith("/src/lib/runtime-logs/event-types.ts")
  && identifier.getText() === "RuntimeLogEventType";

const isRuntimeLogEventTypeNamespace = (node: MorphNode | null, depth = 0): boolean => {
  const target = unwrapExpression(node);
  if (!target || depth > MAX_TRACE_DEPTH) {
    return false;
  }
  if (Node.isIdentifier(target)) {
    return matchesRuntimeLogEventTypeImport(target) || isRuntimeLogEventTypeSourceIdentifier(target);
  }
  if (Node.isPropertyAccessExpression(target) || Node.isElementAccessExpression(target)) {
    return isRuntimeLogEventTypeNamespace(target.getExpression(), depth + 1);
  }
  return false;
};

const isEventTypeInitializerFromRegistry = (expression: Expression | null, depth = 0): boolean => {
  const target = toExpression(unwrapExpression(expression));
  if (!target || depth > MAX_TRACE_DEPTH) {
    return false;
  }
  if (Node.isPropertyAccessExpression(target)) {
    return isRuntimeLogEventTypeNamespace(target.getExpression(), depth + 1);
  }
  if (Node.isIdentifier(target)) {
    if (isRuntimeLogEventTypeNamespace(target, depth + 1)) {
      return true;
    }
    const traced = traceVariableInitializer(target, depth + 1) ?? traceDestructuredBinding(target, depth + 1);
    return isEventTypeInitializerFromRegistry(toExpression(traced), depth + 1);
  }
  return false;
};

export const containsUnresolvedSpread = (objectLiteral: ObjectLiteralExpression): boolean =>
  objectLiteral.getProperties().some((property) =>
    Node.isSpreadAssignment(property) && resolveObjectLiteralExpression(property.getExpression()) === null,
  );

export const getPropertyInitializer = (objectLiteral: ObjectLiteralExpression, propertyName: string): Expression | null => {
  const property = getNamedProperty(objectLiteral, propertyName);
  if (Node.isPropertyAssignment(property)) return property.getInitializer() ?? null;
  if (Node.isShorthandPropertyAssignment(property)) {
    return toExpression(traceVariableInitializer(property.getNameNode()));
  }
  for (const spreadObject of listSpreadObjectLiterals(objectLiteral)) {
    const spreadInitializer = getPropertyInitializer(spreadObject, propertyName);
    if (spreadInitializer) {
      return spreadInitializer;
    }
  }
  return null;
};

export const hasProperty = (objectLiteral: ObjectLiteralExpression, propertyName: string): boolean =>
  Boolean(getNamedProperty(objectLiteral, propertyName)) || Boolean(getPropertyInitializer(objectLiteral, propertyName));

export const getNestedObject = (objectLiteral: ObjectLiteralExpression, propertyName: string): ObjectLiteralExpression | null => {
  const initializer = getPropertyInitializer(objectLiteral, propertyName);
  return initializer ? resolveObjectLiteralExpression(initializer) : null;
};

export const hasNestedProperty = (objectLiteral: ObjectLiteralExpression, path: readonly string[]): boolean => {
  const [head, ...tail] = path;
  if (!head) return true;
  if (tail.length === 0) return hasProperty(objectLiteral, head);
  const nested = getNestedObject(objectLiteral, head);
  return nested ? hasNestedProperty(nested, tail) : false;
};

export const getStringLiteralProperty = (objectLiteral: ObjectLiteralExpression, propertyName: string): string | null =>
  getStringLiteralValue(getPropertyInitializer(objectLiteral, propertyName));

export const getArrayLiteralPropertyValues = (objectLiteral: ObjectLiteralExpression, propertyName: string): string[] | null => {
  const initializer = getPropertyInitializer(objectLiteral, propertyName);
  const target = initializer && Node.isIdentifier(initializer)
    ? toExpression(traceVariableInitializer(initializer) ?? traceDestructuredBinding(initializer))
    : initializer;
  if (!target || !Node.isArrayLiteralExpression(target)) return null;
  const values: string[] = [];
  for (const element of target.getElements()) {
    if (!Node.isStringLiteral(element)) return null;
    const value = element.getLiteralValue();
    if (value.length > 0) values.push(value);
  }
  return values;
};

export const isEventTypeFromRegistry = (objectLiteral: ObjectLiteralExpression): boolean =>
  isEventTypeInitializerFromRegistry(getPropertyInitializer(objectLiteral, "eventType"));
