import { Node } from "ts-morph";

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
  if (!Node.isPropertyAccessExpression(callee) || callee.getExpression().getText() !== "Object") {
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
    const parent = referenceNode.getParent();
    if (parent && Node.isPropertyAccessExpression(parent) && parent.getExpression() === referenceNode) {
      usedPropertyNames.add(parent.getName());
      continue;
    }
    if (parent && Node.isElementAccessExpression(parent) && parent.getExpression() === referenceNode) {
      const argument = parent.getArgumentExpression();
      if (argument && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))) {
        usedPropertyNames.add(argument.getLiteralValue());
        continue;
      }
    }
    const consumerFilePath = toRepoPath(referenceNode.getSourceFile().getFilePath());
    if (isLawfulDynamicRegistryConsumer(
      input.manifest,
      consumerFilePath,
      input.bag.governedFile.repoPath,
      input.bag.exportName,
    )) {
      for (const entry of input.bag.entries) {
        usedPropertyNames.add(entry.propertyName);
      }
      continue;
    }
    if (!isDynamicBagUsage(referenceNode)) {
      continue;
    }
    dynamicUsages.push({
      consumerFilePath,
      line: referenceNode.getStartLineNumber(),
      sourceText: referenceNode.getParent()?.getText() ?? referenceNode.getText(),
    });
  }

  return {
    dynamicUsages,
    usedPropertyNames,
  };
};