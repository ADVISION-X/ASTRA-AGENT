import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";

import { pathFromRepoRoot } from "./inspection-core.js";

export const createAuditProject = (): Project => {
  return new Project({
    tsConfigFilePath: pathFromRepoRoot("tsconfig.json"),
    skipAddingFilesFromTsConfig: false,
  });
};

export const getSourceFileOrThrow = (project: Project, repoRelativePath: string): SourceFile => {
  const sourceFile = project.getSourceFile(pathFromRepoRoot(repoRelativePath));
  if (!sourceFile) {
    throw new Error(`Missing source file: ${repoRelativePath}`);
  }

  return sourceFile;
};

export const hasImportModuleSpecifier = (sourceFile: SourceFile, marker: string): boolean => {
  return sourceFile.getImportDeclarations().some((declaration) => declaration.getModuleSpecifierValue().includes(marker));
};

const flattenPropertyAccessMember = (node: Node): string[] | null => {
  return Node.isPropertyAccessExpression(node)
    ? [...flattenPropertyAccess(node.getExpression()), node.getName()]
    : null;
};

const flattenPropertyAccessIdentifier = (node: Node): string[] | null => {
  return Node.isIdentifier(node) ? [node.getText()] : null;
};

const flattenPropertyAccessThis = (node: Node): string[] | null => {
  return node.getKind() === SyntaxKind.ThisKeyword ? ["this"] : null;
};

const flattenPropertyAccessElement = (node: Node): string[] | null => {
  if (!Node.isElementAccessExpression(node)) {
    return null;
  }

  const argument = node.getArgumentExpression();
  return argument && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))
    ? [...flattenPropertyAccess(node.getExpression()), argument.getLiteralText()]
    : [];
};

const flattenPropertyAccess = (node: Node | undefined): string[] => {
  if (!node) {
    return [];
  }

  return flattenPropertyAccessMember(node)
    ?? flattenPropertyAccessIdentifier(node)
    ?? flattenPropertyAccessThis(node)
    ?? flattenPropertyAccessElement(node)
    ?? [];
};

export const hasCallExpressionPath = (node: Node, pathParts: string[]): boolean => {
  return node.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expressionPath = flattenPropertyAccess(callExpression.getExpression());
    return expressionPath.length === pathParts.length && expressionPath.every((part, index) => part === pathParts[index]);
  });
};

export const getZodEnumValues = (sourceFile: SourceFile, declarationName: string): string[] => {
  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const initializer = declaration?.getInitializerIfKind(SyntaxKind.CallExpression);
  const firstArgument = initializer?.getArguments()[0];
  if (!firstArgument) {
    return [];
  }

  const enumArray = Node.isArrayLiteralExpression(firstArgument)
    ? firstArgument
    : Node.isIdentifier(firstArgument)
      ? firstArgument.getDefinitions()
        .map((definition) => definition.getDeclarationNode())
        .map((definitionNode) => {
          return definitionNode && Node.isVariableDeclaration(definitionNode) ? definitionNode.getInitializer() : undefined;
        })
        .find((definitionNode) => Boolean(definitionNode) && Node.isArrayLiteralExpression(definitionNode))
      : undefined;

  return enumArray && Node.isArrayLiteralExpression(enumArray)
    ? enumArray.getElements().flatMap((element) => Node.isStringLiteral(element) ? [element.getLiteralText()] : [])
    : [];
};

export const hasInterfaceMethod = (sourceFile: SourceFile, interfaceName: string, methodName: string): boolean => {
  return Boolean(sourceFile.getInterface(interfaceName)?.getMethod(methodName));
};

export const hasIdentifier = (node: Node, identifierName: string): boolean => {
  return node.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === identifierName);
};