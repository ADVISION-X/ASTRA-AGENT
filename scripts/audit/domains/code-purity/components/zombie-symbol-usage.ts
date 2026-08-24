import { Node, type Node as MorphNode } from "ts-morph";

import { isZombieTypePosition } from "./zombie-type-runtime-classifier.js";

export type ZombieSymbolUsageKind =
  | "dynamic"
  | "import-binding"
  | "namespace-property"
  | "re-export"
  | "runtime"
  | "type"
  | "unknown";

export type ZombieSymbolReference = {
  line: number;
  referencingFile: string;
  sourceText: string;
  usageKind: ZombieSymbolUsageKind;
};

const isImportBindingReference = (node: MorphNode): boolean => {
  const parent = node.getParent();
  return Boolean(
    parent && (
      Node.isImportSpecifier(parent)
      || Node.isImportClause(parent)
      || Node.isNamespaceImport(parent)
      || Node.isImportEqualsDeclaration(parent)
    ),
  );
};

const isReExportReference = (node: MorphNode): boolean => {
  const parent = node.getParent();
  return Boolean(parent && Node.isExportSpecifier(parent));
};

export const classifyZombieReferenceUsage = (node: MorphNode): ZombieSymbolUsageKind => {
  const parent = node.getParent();
  if (isImportBindingReference(node)) {
    return "import-binding";
  }
  if (isReExportReference(node)) {
    return "re-export";
  }
  if (parent && Node.isPropertyAccessExpression(parent) && parent.getNameNode() === node) {
    return "namespace-property";
  }
  if (isZombieTypePosition(node)) {
    return "type";
  }
  if (parent && Node.isCallExpression(parent) && parent.getExpression().getKindName() === "ImportKeyword") {
    return "dynamic";
  }
  return "runtime";
};

export const isMeaningfulZombieReference = (usageKind: ZombieSymbolUsageKind): boolean =>
  usageKind !== "import-binding" && usageKind !== "re-export";

export const isZombieRuntimeUsage = (usageKind: ZombieSymbolUsageKind): boolean =>
  usageKind === "runtime" || usageKind === "namespace-property" || usageKind === "dynamic";

export const isZombieTypeUsage = (usageKind: ZombieSymbolUsageKind): boolean => usageKind === "type";
