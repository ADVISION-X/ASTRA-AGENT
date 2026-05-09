import path from "node:path";

import { Node, Project, SyntaxKind, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { getNodeLine } from "../../core/ts-morph.js";

import { localBrowserSessionInspectionConstants as config } from "./inspection-constants.js";
import { localBrowserSessionForbiddenReferences as forbiddenReferences } from "./inspection-forbidden-references.js";

const looseScriptProject = new Project({
  useInMemoryFileSystem: true,
  skipFileDependencyResolution: true,
});

const includesAll = (text: string, markers: readonly string[]): boolean => markers.every((marker) => text.includes(marker));

const debug = (message: string): void => {
  process.stdout.write(`[owner-inspector:local-browser-session] ${message}\n`);
};

const hasScriptExtension = (filePath: string): boolean => config.SCRIPT_EXTENSIONS.some((extension) => filePath.endsWith(extension));

const isForbiddenTestPath = (filePath: string): boolean => {
  return filePath.includes("/__tests__/")
    || filePath.startsWith("tests/")
    || filePath.includes("/tests/")
    || config.SCRIPT_EXTENSIONS.some((extension) => filePath.endsWith(`.test${extension}`));
};

const createLooseSourceFile = (relativePath: string, content: string): SourceFile => {
  const existing = looseScriptProject.getSourceFile(relativePath);
  if (existing) {
    existing.replaceWithText(content);
    return existing;
  }

  return looseScriptProject.createSourceFile(relativePath, content, { overwrite: true });
};

const getZodObjectPropertyNames = (sourceFile: SourceFile, declarationName: string): Set<string> => {
  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const initializer = declaration?.getInitializerIfKind(SyntaxKind.CallExpression);
  const firstArgument = initializer?.getArguments()[0];
  if (!firstArgument || !Node.isObjectLiteralExpression(firstArgument)) {
    return new Set();
  }

  return new Set(
    firstArgument
      .getProperties()
      .filter((property): property is import("ts-morph").PropertyAssignment | import("ts-morph").ShorthandPropertyAssignment =>
        Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property))
      .map((property) => property.getName()),
  );
};

const getTypeAliasPropertyNames = (sourceFile: SourceFile, declarationName: string): Set<string> => {
  const declaration = sourceFile.getTypeAlias(declarationName);
  const typeNode = declaration?.getTypeNode();
  if (!typeNode || !Node.isTypeLiteral(typeNode)) {
    return new Set();
  }

  return new Set(
    typeNode
      .getProperties()
      .filter((property): property is import("ts-morph").PropertySignature => Node.isPropertySignature(property))
      .map((property) => property.getName()),
  );
};

const getZodEnumValues = (sourceFile: SourceFile, declarationName: string): Set<string> => {
  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const initializer = declaration?.getInitializerIfKind(SyntaxKind.CallExpression);
  const firstArgument = initializer?.getArguments()[0];
  if (!firstArgument || !Node.isArrayLiteralExpression(firstArgument)) {
    return new Set();
  }

  return new Set(
    firstArgument
      .getElements()
      .filter((element): element is import("ts-morph").StringLiteral => Node.isStringLiteral(element))
      .map((element) => element.getLiteralText()),
  );
};

const getImportedNamedBindings = (sourceFile: SourceFile, moduleSpecifier: string): Set<string> => {
  const importDeclaration = sourceFile.getImportDeclarations().find((item) => item.getModuleSpecifierValue() === moduleSpecifier);
  return new Set(importDeclaration?.getNamedImports().map((namedImport) => namedImport.getName()) ?? []);
};

const getExpressionPath = (node: Node | undefined): string[] => {
  if (!node) {
    return [];
  }
  if (Node.isPropertyAccessExpression(node)) {
    return [...getExpressionPath(node.getExpression()), node.getName()];
  }
  if (Node.isIdentifier(node)) {
    return [node.getText()];
  }
  if (Node.isElementAccessExpression(node)) {
    const argument = node.getArgumentExpression();
    if (argument && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))) {
      return [...getExpressionPath(node.getExpression()), argument.getLiteralText()];
    }
  }
  return [];
};

const getFunctionLike = (sourceFile: SourceFile, name: string): Node | null => {
  const variableInitializer = sourceFile.getVariableDeclaration(name)?.getInitializer();
  if (variableInitializer && (Node.isArrowFunction(variableInitializer) || Node.isFunctionExpression(variableInitializer))) {
    return variableInitializer;
  }
  return sourceFile.getFunction(name) ?? null;
};

const getReturnedObjectLiteralFromExpression = (expression: Node | undefined): ObjectLiteralExpression | null => {
  if (!expression) {
    return null;
  }
  if (Node.isObjectLiteralExpression(expression)) {
    return expression;
  }
  if (Node.isCallExpression(expression)) {
    const firstArgument = expression.getArguments()[0];
    return firstArgument && Node.isObjectLiteralExpression(firstArgument) ? firstArgument : null;
  }
  return null;
};

const getReturnedObjectLiteral = (node: Node | null): ObjectLiteralExpression | null => {
  if (!node) {
    return null;
  }
  if (Node.isArrowFunction(node)) {
    const fromBody = getReturnedObjectLiteralFromExpression(node.getBody());
    if (fromBody) {
      return fromBody;
    }
  }
  const returnStatement = node.getDescendantsOfKind(SyntaxKind.ReturnStatement).find((statement) => Boolean(getReturnedObjectLiteralFromExpression(statement.getExpression())));
  return getReturnedObjectLiteralFromExpression(returnStatement?.getExpression());
};

const getObjectLiteralArgument = (expression: import("ts-morph").CallExpression | import("ts-morph").NewExpression | null, index = 0): ObjectLiteralExpression | null => {
  const argument = expression?.getArguments()[index];
  return argument && Node.isObjectLiteralExpression(argument) ? argument : null;
};

const getObjectLiteralPropertyNames = (objectLiteral: ObjectLiteralExpression | null): Set<string> => {
  if (!objectLiteral) {
    return new Set();
  }
  return new Set(
    objectLiteral
      .getProperties()
      .filter((property): property is import("ts-morph").PropertyAssignment | import("ts-morph").ShorthandPropertyAssignment =>
        Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property))
      .map((property) => property.getName()),
  );
};

const objectLiteralReferencesIdentifier = (objectLiteral: ObjectLiteralExpression | null, identifierName: string): boolean => {
  return Boolean(objectLiteral?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === identifierName));
};

const getPropertyInitializerText = (objectLiteral: ObjectLiteralExpression | null, propertyName: string): string | null => {
  const property = objectLiteral?.getProperty(propertyName);
  if (!property) {
    return null;
  }
  if (Node.isShorthandPropertyAssignment(property)) {
    return property.getName();
  }
  return Node.isPropertyAssignment(property) ? property.getInitializer()?.getText() ?? null : null;
};

const hasIdentifier = (sourceFile: SourceFile, identifierName: string): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === identifierName);
};

const hasProcessEnvReference = (sourceFile: SourceFile, envKey: string): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => {
    const pathParts = getExpressionPath(expression);
    return pathParts.length === 3 && pathParts[0] === "process" && pathParts[1] === "env" && pathParts[2] === envKey;
  });
};

const findCallByIdentifier = (sourceFile: SourceFile, identifierName: string) => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === identifierName;
  }) ?? null;
};

const hasCallByIdentifier = (node: Node, identifierName: string): boolean => {
  return node.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === identifierName;
  });
};

const hasTemplateLiteralMarker = (node: Node, marker: string): boolean => {
  return node.getDescendants().some((descendant) => {
    if (Node.isNoSubstitutionTemplateLiteral(descendant)) {
      return descendant.getLiteralText().includes(marker);
    }
    return Node.isTemplateExpression(descendant) && descendant.getText().includes(marker);
  });
};

const hasImportFrom = (sourceFile: SourceFile, moduleSpecifier: string): boolean => {
  return sourceFile.getImportDeclarations().some((importDeclaration) => importDeclaration.getModuleSpecifierValue() === moduleSpecifier);
};

const resolveControllerPath = (controllerSource: SourceFile): string => {
  return path.relative(process.cwd(), controllerSource.getFilePath()).replace(/\\/g, "/");
};

const { hasForbiddenApiUsage, hasForbiddenModuleReference } = forbiddenReferences;

export const localBrowserSessionInspectionUtils = {
  createLooseSourceFile,
  debug,
  findCallByIdentifier,
  getFunctionLike,
  getImportedNamedBindings,
  getObjectLiteralArgument,
  getObjectLiteralPropertyNames,
  getPropertyInitializerText,
  getReturnedObjectLiteral,
  getTypeAliasPropertyNames,
  getZodEnumValues,
  getZodObjectPropertyNames,
  hasCallByIdentifier,
  hasForbiddenApiUsage,
  hasForbiddenModuleReference,
  hasIdentifier,
  hasImportFrom,
  hasProcessEnvReference,
  hasScriptExtension,
  hasTemplateLiteralMarker,
  includesAll,
  isForbiddenTestPath,
  objectLiteralReferencesIdentifier,
  resolveControllerPath,
};
