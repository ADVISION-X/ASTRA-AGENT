import { Node } from "ts-morph";

import { astIdentifierName } from "../../../shared/ast-node-identity.js";
import { toRepoPath } from "../../../shared/paths.js";
import {
  isLawfulDynamicRegistryConsumer,
  type ZombieExemptionManifest,
} from "./zombie-exemption-manifest.js";
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

const markLawfulRegistryUsage = (input: {
  bag: ZombieObjectBag;
  manifest: ZombieExemptionManifest;
  consumerFilePath: string;
  usedPropertyNames: Set<string>;
}): boolean => {
  if (!isLawfulDynamicRegistryConsumer(
    input.manifest,
    input.consumerFilePath,
    input.bag.governedFile.repoPath,
    input.bag.exportName,
  )) {
    return false;
  }
  for (const entry of input.bag.entries) {
    input.usedPropertyNames.add(entry.propertyName);
  }
  return true;
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
  manifest: ZombieExemptionManifest;
}): ZombieObjectBagUsage => {
  const usedPropertyNames = new Set<string>();
  const dynamicUsages: ZombieObjectBagDynamicUsage[] = [];

  for (const referenceNode of input.bag.nameNode.findReferencesAsNodes()) {
    if (referenceNode === input.bag.nameNode) {
      continue;
    }
    const usageKind = classifyZombieReferenceUsage(referenceNode);
    if (usageKind === "import-binding" || usageKind === "re-export") {
      continue;
    }
    if (markStaticPropertyUsage(referenceNode, usedPropertyNames)) {
      continue;
    }
    const consumerFilePath = toRepoPath(referenceNode.getSourceFile().getFilePath());
    if (markLawfulRegistryUsage({
      bag: input.bag,
      manifest: input.manifest,
      consumerFilePath,
      usedPropertyNames,
    })) {
      continue;
    }
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
