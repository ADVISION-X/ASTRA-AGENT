import {
  Node,
  SyntaxKind,
  VariableDeclarationKind,
  type CallExpression,
  type ImportSpecifier,
  type SourceFile,
  type VariableDeclaration,
} from "ts-morph";

const resolvesTo = (node: Node | undefined, declaration: Node): boolean =>
  Node.isIdentifier(node)
  && (node.getSymbol()?.getDeclarations().includes(declaration) ?? false);

const directNamedImport = (source: SourceFile): ImportSpecifier | null => {
  const httpImports = source.getImportDeclarations()
    .filter((declaration) => declaration.getModuleSpecifierValue() === "node:http");
  if (httpImports.some((declaration) =>
    declaration.getDefaultImport() !== undefined || declaration.getNamespaceImport() !== undefined)) return null;
  const specifiers = httpImports.flatMap((declaration) => declaration.getNamedImports())
    .filter((specifier) => specifier.getName() === "createServer");
  return specifiers.length === 1 ? specifiers[0] ?? null : null;
};

const directCalls = (source: SourceFile, specifier: ImportSpecifier): CallExpression[] | null => {
  const calls: CallExpression[] = [];
  for (const identifier of source.getDescendantsOfKind(SyntaxKind.Identifier)) {
    if (identifier.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)
      || !resolvesTo(identifier, specifier)) continue;
    const parent = identifier.getParent();
    if (!Node.isCallExpression(parent) || parent.getExpression() !== identifier) return null;
    calls.push(parent);
  }
  return calls;
};

export const uniqueNodeHttpServerDeclaration = (source: SourceFile): VariableDeclaration | null => {
  const specifier = directNamedImport(source);
  if (!specifier) return null;
  const calls = directCalls(source, specifier);
  const call = calls?.length === 1 ? calls[0] : undefined;
  const declaration = call?.getParent();
  return Node.isVariableDeclaration(declaration)
    && declaration.getInitializer() === call
    && declaration.getVariableStatement()?.getDeclarationKind() === VariableDeclarationKind.Const
    ? declaration
    : null;
};
