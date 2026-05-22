import { Node, SyntaxKind, type Identifier, type ImportDeclaration, type Node as MorphNode } from "ts-morph";

const MAX_TRACE_DEPTH = 8;

const getAliasedOrDirectSymbol = (node: MorphNode) => {
  const symbol = node.getSymbol();
  if (!symbol) {
    return null;
  }
  const checker = node.getProject().getTypeChecker();
  return checker.getAliasedSymbol(symbol) ?? symbol;
};

export const unwrapExpression = (node: MorphNode | null | undefined): MorphNode | null => {
  let current = node ?? null;
  while (current) {
    if (Node.isParenthesizedExpression(current) || Node.isAsExpression(current) || Node.isTypeAssertion(current) || Node.isNonNullExpression(current)) {
      current = current.getExpression();
      continue;
    }
    return current;
  }
  return null;
};

const resolveSymbolName = (node: MorphNode): string | null =>
  getAliasedOrDirectSymbol(node)?.getName() ?? null;

const resolveAliasedSymbolName = (node: MorphNode): string | null => {
  const symbol = node.getSymbol();
  if (!symbol) {
    return null;
  }
  const checker = node.getProject().getTypeChecker();
  return checker.getAliasedSymbol(symbol)?.getName() ?? symbol.getName();
};

export const traceImportedBinding = (identifier: Identifier): ImportDeclaration | null => {
  const symbol = identifier.getSymbol();
  const declarations = symbol?.getDeclarations() ?? [];
  for (const declaration of declarations) {
    const importDeclaration = declaration.getFirstAncestorByKind(SyntaxKind.ImportDeclaration);
    if (importDeclaration) {
      return importDeclaration;
    }
  }
  return null;
};

const matchesImportedSpecifier = (input: {
  imported: ImportDeclaration;
  moduleFragment: string;
  exportName: string;
  identifierText: string;
}): boolean => {
  if (!input.imported.getModuleSpecifierValue().includes(input.moduleFragment)) {
    return false;
  }
  return input.imported.getNamedImports().some((item) => {
    const importName = item.getNameNode().getText();
    const aliasName = item.getAliasNode()?.getText() ?? importName;
    return importName === input.exportName && aliasName === input.identifierText;
  });
};

export const isSymbolFromModule = (node: MorphNode, moduleFragment: string, exportName: string): boolean => {
  const target = unwrapExpression(node);
  if (!target) {
    return false;
  }
  if (Node.isPropertyAccessExpression(target) || Node.isElementAccessExpression(target)) {
    return isSymbolFromModule(target.getExpression(), moduleFragment, exportName);
  }
  if (!Node.isIdentifier(target)) {
    return false;
  }
  const imported = traceImportedBinding(target);
  return Boolean(imported && matchesImportedSpecifier({
    imported,
    moduleFragment,
    exportName,
    identifierText: target.getText(),
  }));
};

const traceBindingSource = (identifier: Identifier): {
  source: MorphNode | null;
  propertyName: string | null;
} | null => {
  const symbol = identifier.getSymbol();
  const declarations = symbol?.getDeclarations() ?? [];
  for (const declaration of declarations) {
    if (!Node.isBindingElement(declaration)) {
      continue;
    }
    const propertyName = declaration.getPropertyNameNode()?.getText() ?? declaration.getNameNode().getText();
    const owner = declaration.getFirstAncestor((ancestor) =>
      Node.isVariableDeclaration(ancestor) || Node.isParameterDeclaration(ancestor),
    );
    if (Node.isVariableDeclaration(owner) || Node.isParameterDeclaration(owner)) {
      return {
        source: unwrapExpression(owner.getInitializer()),
        propertyName,
      };
    }
  }
  return null;
};

const traceObjectLiteralProperty = (target: MorphNode, propertyName: string, depth: number): MorphNode | null | undefined => {
  const fromObject = Node.isObjectLiteralExpression(target) ? target.getProperty(propertyName) : undefined;
  if (Node.isPropertyAssignment(fromObject)) {
    return unwrapExpression(fromObject.getInitializer());
  }
  if (Node.isShorthandPropertyAssignment(fromObject)) {
    return traceVariableInitializer(fromObject.getNameNode(), depth + 1);
  }
  return undefined;
};

const traceIdentifierProperty = (target: MorphNode, propertyName: string, depth: number): MorphNode | undefined => {
  if (!Node.isIdentifier(target)) {
    return undefined;
  }
  const traced = traceVariableInitializer(target, depth + 1);
  if (traced && traced !== target) {
    return tracePropertyFromSource(traced, propertyName, depth + 1) ?? traced;
  }
  return undefined;
};

const tracePropertyFromSource = (source: MorphNode | null, propertyName: string | null, depth: number): MorphNode | null => {
  const target = unwrapExpression(source);
  if (!target || depth > MAX_TRACE_DEPTH) {
    return null;
  }
  if (!propertyName) {
    return target;
  }
  const objectProperty = traceObjectLiteralProperty(target, propertyName, depth);
  if (objectProperty) {
    return objectProperty;
  }
  const tracedIdentifier = traceIdentifierProperty(target, propertyName, depth);
  if (tracedIdentifier) {
    return tracedIdentifier;
  }
  return target;
};

const identifierMatchesExpectedName = (identifier: Identifier, expectedName: string): boolean =>
  identifier.getText() === expectedName
  || resolveSymbolName(identifier) === expectedName
  || resolveAliasedSymbolName(identifier) === expectedName;

const tracedBindingMatchesExpectedName = (traced: MorphNode, expectedName: string): boolean => {
  if (Node.isIdentifier(traced)) {
    return isIdentifierBoundTo(traced, expectedName);
  }
  return Node.isPropertyAccessExpression(traced)
    && (traced.getName() === expectedName || resolveAliasedSymbolName(traced) === expectedName);
};

export const isIdentifierBoundTo = (node: MorphNode, expectedName: string): boolean => {
  const target = unwrapExpression(node);
  if (!target || !Node.isIdentifier(target)) {
    return false;
  }
  if (identifierMatchesExpectedName(target, expectedName)) {
    return true;
  }
  const traced = traceVariableInitializer(target);
  if (!traced || traced === target) {
    return false;
  }
  return tracedBindingMatchesExpectedName(traced, expectedName);
};

const initializerFromDeclaration = (identifier: Identifier, declaration: MorphNode, depth: number): MorphNode | null => {
  if (Node.isVariableDeclaration(declaration) || Node.isParameterDeclaration(declaration)) {
    return unwrapExpression(declaration.getInitializer());
  }
  if (Node.isBindingElement(declaration)) {
    return traceDestructuredBinding(identifier, depth + 1);
  }
  if (Node.isImportSpecifier(declaration) || Node.isImportClause(declaration) || Node.isNamespaceImport(declaration)) {
    return declaration;
  }
  return null;
};

export const traceVariableInitializer = (identifier: Identifier, depth = 0): MorphNode | null => {
  if (depth > MAX_TRACE_DEPTH) {
    return null;
  }
  const symbol = identifier.getSymbol();
  const declarations = symbol?.getDeclarations() ?? [];
  for (const declaration of declarations) {
    const initializer = initializerFromDeclaration(identifier, declaration, depth);
    if (initializer) {
      return initializer;
    }
  }
  return null;
};

export const traceDestructuredBinding = (identifier: Identifier, depth = 0): MorphNode | null => {
  if (depth > MAX_TRACE_DEPTH) {
    return null;
  }
  const bindingSource = traceBindingSource(identifier);
  if (!bindingSource) {
    return null;
  }
  return tracePropertyFromSource(bindingSource.source, bindingSource.propertyName, depth + 1);
};
