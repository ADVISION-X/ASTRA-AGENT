import { Node, SyntaxKind, type Node as AstNode } from "ts-morph";

import { toRepoPath } from "../../../shared/paths.js";
import type { ZombieObjectBag } from "./zombie-object-bag-liveness.js";
import { classifyZombieReferenceUsage, isZombieRuntimeUsage } from "./zombie-symbol-usage.js";
import { isZombieTypePosition } from "./zombie-type-runtime-classifier.js";

export type ZombieObjectBagDynamicUsage = {
  consumerFilePath: string;
  line: number;
  sourceText: string;
};

export type ZombieObjectBagUsage = {
  dynamicUsages: ZombieObjectBagDynamicUsage[];
  usedPropertyNames: Set<string>;
};

const runtimeReferences = (name: AstNode | undefined, consumerFiles: ReadonlySet<string>): AstNode[] => {
  if (!name || !Node.isIdentifier(name)) return [];
  return name.findReferencesAsNodes().filter((reference) => reference !== name
    && consumerFiles.has(toRepoPath(reference.getSourceFile().getFilePath()))
    && !isZombieTypePosition(reference)
    && isZombieRuntimeUsage(classifyZombieReferenceUsage(reference)));
};

const propertyReads = (name: AstNode | undefined, consumerFiles: ReadonlySet<string>): string[] =>
  runtimeReferences(name, consumerFiles).flatMap((reference) => {
    const access = reference.getParent();
    return access && Node.isPropertyAccessExpression(access) && access.getExpression() === reference
      ? [access.getName()] : [];
  });

const contextualReads = (bag: ZombieObjectBag, consumerFiles: ReadonlySet<string>): string[] => {
  const variable = bag.nameNode.getParent();
  const literal = variable && Node.isVariableDeclaration(variable) ? variable.getInitializer() : undefined;
  if (!literal || !Node.isObjectLiteralExpression(literal)) return [];
  const shape = literal.getContextualType();
  return bag.entries.filter((entry) => shape?.getProperty(entry.propertyName)?.getDeclarations().some((declaration) =>
    runtimeReferences(declaration.getFirstDescendantByKind(SyntaxKind.Identifier), consumerFiles).some((reference) => {
      const access = reference.getParent();
      return access && Node.isPropertyAccessExpression(access) && access.getNameNode() === reference;
    }))).map((entry) => entry.propertyName);
};

const arrayMemberReads = (reference: AstNode, consumerFiles: ReadonlySet<string>): string[] => {
  const array = reference.getFirstAncestorByKind(SyntaxKind.ArrayLiteralExpression);
  const variable = array?.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (!variable) return [];
  return runtimeReferences(variable.getNameNode(), consumerFiles).flatMap((use) => {
    const parent = use.getParent();
    if (parent && Node.isForOfStatement(parent) && parent.getExpression() === use) {
      return propertyReads(parent.getInitializer().getFirstDescendantByKind(SyntaxKind.Identifier), consumerFiles);
    }
    if (!parent || !Node.isPropertyAccessExpression(parent) || parent.getExpression() !== use
      || parent.getName() !== "map") return [];
    const call = parent.getParent();
    const callback = call && Node.isCallExpression(call) ? call.getArguments()[0] : undefined;
    return callback && (Node.isArrowFunction(callback) || Node.isFunctionExpression(callback))
      ? propertyReads(callback.getParameters()[0]?.getNameNode(), consumerFiles) : [];
  });
};

const typedRegistryLookup = (reference: AstNode, consumerFiles: ReadonlySet<string>): boolean => {
  const spread = reference.getParent();
  if (!spread || !Node.isSpreadAssignment(spread)) return false;
  const literal = spread.getParent();
  const variable = literal?.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (!literal || !Node.isObjectLiteralExpression(literal)
    || !variable?.getInitializer()?.getText().includes("satisfies Record<")) return false;
  return runtimeReferences(variable.getNameNode(), consumerFiles).some((use) => {
    const access = use.getParent();
    if (!access || !Node.isElementAccessExpression(access) || access.getExpression() !== use) return false;
    const key = access.getArgumentExpression();
    return Boolean(key && !Node.isStringLiteral(key) && !Node.isNoSubstitutionTemplateLiteral(key));
  });
};

const terminalArgumentProperty = (reference: AstNode): boolean => {
  let value = reference;
  const expression = value.getParent();
  if (expression && Node.isBinaryExpression(expression)
    && expression.getOperatorToken().getKind() === SyntaxKind.QuestionQuestionToken) value = expression;
  const property = value.getParent();
  if (!property || !Node.isPropertyAssignment(property) || property.getInitializer() !== value) return false;
  const literal = property.getParent();
  const call = literal?.getParent();
  return Boolean(literal && Node.isObjectLiteralExpression(literal)
    && call && Node.isCallExpression(call) && call.getArguments().includes(literal));
};

export const collectZombieObjectBagUsage = (input: {
  bag: ZombieObjectBag;
  consumerFiles: ReadonlySet<string>;
}): ZombieObjectBagUsage => {
  const usedPropertyNames = new Set(contextualReads(input.bag, input.consumerFiles));
  const dynamicUsages: ZombieObjectBagDynamicUsage[] = [];
  for (const reference of runtimeReferences(input.bag.nameNode, input.consumerFiles)) {
    const indirect = arrayMemberReads(reference, input.consumerFiles);
    if (indirect.length > 0) {
      for (const property of indirect) usedPropertyNames.add(property);
      continue;
    }
    if (typedRegistryLookup(reference, input.consumerFiles) || terminalArgumentProperty(reference)) {
      for (const entry of input.bag.entries) usedPropertyNames.add(entry.propertyName);
      continue;
    }
    const access = reference.getParent();
    if (access && Node.isPropertyAccessExpression(access) && access.getExpression() === reference) {
      usedPropertyNames.add(access.getName());
      continue;
    }
    const key = access && Node.isElementAccessExpression(access) && access.getExpression() === reference
      ? access.getArgumentExpression() : undefined;
    if (key && (Node.isStringLiteral(key) || Node.isNoSubstitutionTemplateLiteral(key))) {
      usedPropertyNames.add(key.getLiteralValue());
      continue;
    }
    dynamicUsages.push({ consumerFilePath: toRepoPath(reference.getSourceFile().getFilePath()),
      line: reference.getStartLineNumber(), sourceText: access?.getText() ?? reference.getText() });
  }
  return { dynamicUsages, usedPropertyNames };
};
