import { Node, SyntaxKind, ts, type Identifier, type Node as MorphNode } from "ts-morph";

export type ZombieDeclarationClassification = {
  declarationKind: string;
  isRuntimeValue: boolean;
  isTypeOnly: boolean;
  localDeclarationName: string | null;
  supportsTypeUsage: boolean;
};

const getDeclarationNameText = (declaration: MorphNode): string | null => {
  if (
    Node.isClassDeclaration(declaration)
    || Node.isEnumDeclaration(declaration)
    || Node.isFunctionDeclaration(declaration)
    || Node.isInterfaceDeclaration(declaration)
    || Node.isTypeAliasDeclaration(declaration)
    || Node.isVariableDeclaration(declaration)
  ) {
    return declaration.getNameNode()?.getText() ?? null;
  }
  return null;
};

export const getZombieDeclarationNameNode = (declaration: MorphNode): Identifier | undefined => {
  if (
    Node.isClassDeclaration(declaration)
    || Node.isEnumDeclaration(declaration)
    || Node.isFunctionDeclaration(declaration)
    || Node.isInterfaceDeclaration(declaration)
    || Node.isTypeAliasDeclaration(declaration)
    || Node.isVariableDeclaration(declaration)
  ) {
    const nameNode = declaration.getNameNode();
    return nameNode && Node.isIdentifier(nameNode) ? nameNode : undefined;
  }
  return undefined;
};

export const classifyZombieDeclaration = (declaration: MorphNode): ZombieDeclarationClassification => {
  if (Node.isInterfaceDeclaration(declaration)) {
    return {
      declarationKind: "interface",
      isRuntimeValue: false,
      isTypeOnly: true,
      localDeclarationName: getDeclarationNameText(declaration),
      supportsTypeUsage: true,
    };
  }
  if (Node.isTypeAliasDeclaration(declaration)) {
    return {
      declarationKind: "type-alias",
      isRuntimeValue: false,
      isTypeOnly: true,
      localDeclarationName: getDeclarationNameText(declaration),
      supportsTypeUsage: true,
    };
  }
  if (Node.isClassDeclaration(declaration)) {
    return {
      declarationKind: "class",
      isRuntimeValue: true,
      isTypeOnly: false,
      localDeclarationName: getDeclarationNameText(declaration),
      supportsTypeUsage: true,
    };
  }
  if (Node.isEnumDeclaration(declaration)) {
    return {
      declarationKind: "enum",
      isRuntimeValue: true,
      isTypeOnly: false,
      localDeclarationName: getDeclarationNameText(declaration),
      supportsTypeUsage: true,
    };
  }
  if (Node.isFunctionDeclaration(declaration)) {
    return {
      declarationKind: "function",
      isRuntimeValue: true,
      isTypeOnly: false,
      localDeclarationName: getDeclarationNameText(declaration),
      supportsTypeUsage: false,
    };
  }
  if (Node.isVariableDeclaration(declaration)) {
    return {
      declarationKind: "variable",
      isRuntimeValue: true,
      isTypeOnly: false,
      localDeclarationName: getDeclarationNameText(declaration),
      supportsTypeUsage: false,
    };
  }
  return {
    declarationKind: declaration.getKindName(),
    isRuntimeValue: false,
    isTypeOnly: false,
    localDeclarationName: getDeclarationNameText(declaration),
    supportsTypeUsage: false,
  };
};

const isTypeOnlyImportBinding = (node: MorphNode): boolean => {
  const parent = node.getParent();
  if (parent && Node.isImportSpecifier(parent)) {
    return parent.isTypeOnly() || parent.getImportDeclaration().isTypeOnly();
  }
  if (parent && Node.isImportClause(parent)) {
    return parent.isTypeOnly();
  }
  if (parent && Node.isExportSpecifier(parent)) {
    return parent.getExportDeclaration().isTypeOnly();
  }
  return false;
};

export const isZombieTypePosition = (node: MorphNode): boolean => {
  if (isTypeOnlyImportBinding(node)) {
    return true;
  }

  const heritage = node.getAncestors().find(Node.isHeritageClause);
  if (heritage) {
    return heritage.getToken() === SyntaxKind.ImplementsKeyword;
  }

  for (const ancestor of node.getAncestors()) {
    if (ts.isTypeNode(ancestor.compilerNode)) {
      return true;
    }
  }

  return false;
};
