import { Node, SyntaxKind, type Node as MorphNode } from "ts-morph";

import { astIdentifierName } from "../../../shared/ast-node-identity.js";
import { toRepoPath } from "../../../shared/paths.js";
import type { ZombieObjectBag } from "./zombie-object-bag-liveness.js";
import { classifyZombieReferenceUsage } from "./zombie-symbol-usage.js";

export type ZombieObjectBagDynamicUsage = {
  consumerFilePath: string;
  line: number;
  sourceText: string;
};

export type ZombieObjectBagUsage = {
  dynamicUsages: ZombieObjectBagDynamicUsage[];
  usedPropertyNames: Set<string>;
};

const collectPropertyReads = (nameNode: MorphNode | undefined): Set<string> => {
  const properties = new Set<string>();
  if (!nameNode || !Node.isIdentifier(nameNode)) return properties;
  for (const reference of nameNode.findReferencesAsNodes()) {
    const parent = reference.getParent();
    if (parent && Node.isPropertyAccessExpression(parent) && parent.getExpression() === reference) {
      properties.add(parent.getName());
    }
  }
  return properties;
};

const addProperties = (target: Set<string>, source: ReadonlySet<string>): void => {
  for (const property of source) target.add(property);
};

const contextualTypePropertyReads = (bag: ZombieObjectBag): Set<string> => {
  const properties = new Set<string>();
  const declaration = bag.nameNode.getParent();
  if (!declaration || !Node.isVariableDeclaration(declaration)) return properties;
  const initializer = declaration.getInitializer();
  if (!initializer || !Node.isObjectLiteralExpression(initializer)) return properties;
  const contextualType = initializer.getContextualType();
  if (!contextualType) return properties;
  for (const entry of bag.entries) {
    const propertySymbol = contextualType.getProperty(entry.propertyName);
    const hasRuntimeRead = propertySymbol?.getDeclarations().some((propertyDeclaration) => {
      const propertyName = propertyDeclaration.getFirstDescendantByKind(SyntaxKind.Identifier);
      return propertyName?.findReferencesAsNodes().some((reference) => {
        const parent = reference.getParent();
        return Boolean(parent && Node.isPropertyAccessExpression(parent)
          && parent.getNameNode() === reference);
      });
    }) ?? false;
    if (hasRuntimeRead) properties.add(entry.propertyName);
  }
  return properties;
};

const forOfElementPropertyReads = (reference: MorphNode): Set<string> => {
  const parent = reference.getParent();
  if (!parent || !Node.isForOfStatement(parent) || parent.getExpression() !== reference) return new Set();
  return collectPropertyReads(parent.getInitializer().getFirstDescendantByKind(SyntaxKind.Identifier));
};

const mapElementPropertyReads = (reference: MorphNode): Set<string> => {
  const property = reference.getParent();
  if (!property || !Node.isPropertyAccessExpression(property) || property.getExpression() !== reference
    || property.getName() !== "map") return new Set();
  const call = property.getParent();
  if (!call || !Node.isCallExpression(call)) return new Set();
  const callback = call.getArguments()[0];
  if (!callback || (!Node.isArrowFunction(callback) && !Node.isFunctionExpression(callback))) return new Set();
  return collectPropertyReads(callback.getParameters()[0]?.getNameNode());
};

const arrayElementPropertyReads = (referenceNode: MorphNode): Set<string> => {
  const properties = new Set<string>();
  const array = referenceNode.getFirstAncestorByKind(SyntaxKind.ArrayLiteralExpression);
  const declaration = array?.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  const nameNode = declaration?.getNameNode();
  if (!array || !nameNode || !Node.isIdentifier(nameNode)) return properties;
  for (const reference of nameNode.findReferencesAsNodes()) {
    addProperties(properties, forOfElementPropertyReads(reference));
    addProperties(properties, mapElementPropertyReads(reference));
  }
  return properties;
};

const isTotalTypedRegistrySpread = (referenceNode: MorphNode): boolean => {
  const spread = referenceNode.getParent();
  if (!spread || !Node.isSpreadAssignment(spread)) return false;
  const object = spread.getParent();
  const declaration = object?.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  const nameNode = declaration?.getNameNode();
  if (!object || !Node.isObjectLiteralExpression(object)
    || !declaration?.getInitializer()?.getText().includes("satisfies Record<")
    || !nameNode || !Node.isIdentifier(nameNode)) return false;
  return nameNode.findReferencesAsNodes().some((reference) => {
    const parent = reference.getParent();
    if (!parent || !Node.isElementAccessExpression(parent) || parent.getExpression() !== reference) return false;
    const key = parent.getArgumentExpression();
    return Boolean(key && !Node.isStringLiteral(key) && !Node.isNoSubstitutionTemplateLiteral(key));
  });
};

const terminalObjectProperty = (
  referenceNode: Parameters<typeof classifyZombieReferenceUsage>[0],
): boolean => {
  let valueNode = referenceNode;
  const binary = valueNode.getParent();
  if (binary && Node.isBinaryExpression(binary)
    && binary.getOperatorToken().getKindName() === "QuestionQuestionToken") {
    valueNode = binary;
  }
  const property = valueNode.getParent();
  if (!property || !Node.isPropertyAssignment(property) || property.getInitializer() !== valueNode) {
    return false;
  }
  const objectLiteral = property.getParent();
  const call = objectLiteral?.getParent();
  return Boolean(objectLiteral && Node.isObjectLiteralExpression(objectLiteral)
    && call && Node.isCallExpression(call) && call.getArguments().includes(objectLiteral));
};

const isDynamicObjectUtilityCall = (referenceNode: Parameters<typeof classifyZombieReferenceUsage>[0]): boolean => {
  const parent = referenceNode.getParent();
  if (!parent || !Node.isCallExpression(parent)) {
    return false;
  }
  const callee = parent.getExpression();
  if (!Node.isPropertyAccessExpression(callee) || !Node.isIdentifier(callee.getExpression())
    || astIdentifierName(callee.getExpression()) !== "Object") {
    return false;
  }
  const methodName = callee.getName();
  return ["entries", "keys", "values"].includes(methodName) && parent.getArguments()[0] === referenceNode;
};

const isDynamicBagUsage = (referenceNode: Parameters<typeof classifyZombieReferenceUsage>[0]): boolean => {
  const parent = referenceNode.getParent();
  if (!parent) {
    return true;
  }
  if (Node.isElementAccessExpression(parent) && parent.getExpression() === referenceNode) {
    const argument = parent.getArgumentExpression();
    return !(argument && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument)));
  }
  if (isDynamicObjectUtilityCall(referenceNode)) {
    return true;
  }
  if (Node.isForInStatement(parent) && parent.getExpression() === referenceNode) {
    return true;
  }
  return !Node.isPropertyAccessExpression(parent);
};

const markStaticPropertyUsage = (
  referenceNode: Parameters<typeof classifyZombieReferenceUsage>[0],
  usedPropertyNames: Set<string>,
): boolean => {
  const parent = referenceNode.getParent();
  if (parent && Node.isPropertyAccessExpression(parent) && parent.getExpression() === referenceNode) {
    usedPropertyNames.add(parent.getName());
    return true;
  }
  if (parent && Node.isElementAccessExpression(parent) && parent.getExpression() === referenceNode) {
    const argument = parent.getArgumentExpression();
    if (argument && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))) {
      usedPropertyNames.add(argument.getLiteralValue());
      return true;
    }
  }
  return false;
};

const buildDynamicUsage = (
  referenceNode: Parameters<typeof classifyZombieReferenceUsage>[0],
  consumerFilePath: string,
): ZombieObjectBagDynamicUsage | null => {
  if (!isDynamicBagUsage(referenceNode)) {
    return null;
  }
  return {
    consumerFilePath,
    line: referenceNode.getStartLineNumber(),
    sourceText: referenceNode.getParent()?.getText() ?? referenceNode.getText(),
  };
};

export const collectZombieObjectBagUsage = (input: {
  bag: ZombieObjectBag;
}): ZombieObjectBagUsage => {
  const usedPropertyNames = contextualTypePropertyReads(input.bag);
  const dynamicUsages: ZombieObjectBagDynamicUsage[] = [];

  for (const referenceNode of input.bag.nameNode.findReferencesAsNodes()) {
    if (referenceNode === input.bag.nameNode) {
      continue;
    }
    const usageKind = classifyZombieReferenceUsage(referenceNode);
    if (usageKind === "import-binding" || usageKind === "re-export") {
      continue;
    }
    if (isTotalTypedRegistrySpread(referenceNode)) {
      for (const entry of input.bag.entries) usedPropertyNames.add(entry.propertyName);
      continue;
    }
    const arrayProperties = arrayElementPropertyReads(referenceNode);
    if (arrayProperties.size > 0) {
      for (const property of arrayProperties) usedPropertyNames.add(property);
      continue;
    }
    if (terminalObjectProperty(referenceNode)) {
      for (const entry of input.bag.entries) usedPropertyNames.add(entry.propertyName);
      continue;
    }
    if (markStaticPropertyUsage(referenceNode, usedPropertyNames)) {
      continue;
    }
    const consumerFilePath = toRepoPath(referenceNode.getSourceFile().getFilePath());
    const dynamicUsage = buildDynamicUsage(referenceNode, consumerFilePath);
    if (dynamicUsage) {
      dynamicUsages.push(dynamicUsage);
    }
  }

  return {
    dynamicUsages,
    usedPropertyNames,
  };
};
