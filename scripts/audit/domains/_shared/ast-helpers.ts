import { Node, Project, SyntaxKind, type MethodDeclaration, type SourceFile } from "ts-morph";

import { pathFromRepoRoot } from "../../core/paths.js";

export function createAuditProject(): Project {
  return new Project({
    tsConfigFilePath: pathFromRepoRoot("tsconfig.json"),
    skipAddingFilesFromTsConfig: false,
  });
}

export function getSourceFileOrThrow(project: Project, repoRelativePath: string): SourceFile {
  const sourceFile = project.getSourceFile(pathFromRepoRoot(repoRelativePath));
  if (!sourceFile) {
    throw new Error(`Missing source file: ${repoRelativePath}`);
  }

  return sourceFile;
}

export function getZodObjectPropertyNames(sourceFile: SourceFile, declarationName: string): Set<string> {
  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const initializer = declaration?.getInitializer();
  const objectCall = initializer && Node.isCallExpression(initializer) && isZodObjectCall(initializer)
    ? initializer
    : initializer?.getDescendantsOfKind(SyntaxKind.CallExpression).find(isZodObjectCall);
  const firstArgument = objectCall?.getArguments()[0];
  if (!firstArgument || !Node.isObjectLiteralExpression(firstArgument)) {
    return new Set();
  }

  return new Set(
    firstArgument
      .getProperties()
      .filter((property) => Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property))
      .map((property) => property.getName()),
  );
}

export function getZodEnumValues(sourceFile: SourceFile, declarationName: string): string[] {
  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const initializer = declaration?.getInitializerIfKind(SyntaxKind.CallExpression);
  const firstArgument = initializer?.getArguments()[0];
  if (!firstArgument) {
    return [];
  }

  const unwrappedArgument = unwrapExpression(firstArgument);
  const enumArray = Node.isArrayLiteralExpression(unwrappedArgument)
    ? unwrappedArgument
    : Node.isIdentifier(firstArgument)
      ? firstArgument.getDefinitions()
        .map((definition) => definition.getDeclarationNode())
        .map((node) => node && Node.isVariableDeclaration(node) ? unwrapExpression(node.getInitializer()) : undefined)
        .find((node) => Boolean(node) && Node.isArrayLiteralExpression(node))
      : undefined;

  if (!enumArray || !Node.isArrayLiteralExpression(enumArray)) {
    return [];
  }

  return enumArray
    .getElements()
    .filter((element) => Node.isStringLiteral(element))
    .map((element) => element.getLiteralText());
}

function unwrapExpression(node: Node | undefined): Node | undefined {
  if (!node) {
    return undefined;
  }

  if (Node.isAsExpression(node) || Node.isSatisfiesExpression(node) || Node.isParenthesizedExpression(node)) {
    return unwrapExpression(node.getExpression());
  }

  return node;
}

function isZodObjectCall(callExpression: Node): boolean {
  if (!Node.isCallExpression(callExpression)) {
    return false;
  }

  const expression = callExpression.getExpression();
  return Node.isPropertyAccessExpression(expression)
    && expression.getExpression().getText() === "z"
    && expression.getName() === "object";
}

export function getTypeAliasPropertyNames(sourceFile: SourceFile, declarationName: string): Set<string> {
  const declaration = sourceFile.getTypeAlias(declarationName);
  const typeNode = declaration?.getTypeNode();
  if (!typeNode || !Node.isTypeLiteral(typeNode)) {
    return new Set();
  }

  return new Set(
    typeNode
      .getProperties()
      .filter((property) => Node.isPropertySignature(property))
      .map((property) => property.getName()),
  );
}

export function hasIdentifier(node: Node, identifierName: string): boolean {
  return node.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === identifierName);
}

export function hasStringLiteral(node: Node, literalValue: string): boolean {
  return node.getDescendants().some((descendant) => {
    return (Node.isStringLiteral(descendant) || Node.isNoSubstitutionTemplateLiteral(descendant))
      && descendant.getLiteralText() === literalValue;
  });
}

export function hasLiteralTextFragment(node: Node, fragment: string): boolean {
  return node.getDescendants().some((descendant) => {
    if (Node.isStringLiteral(descendant) || Node.isNoSubstitutionTemplateLiteral(descendant)) {
      return descendant.getLiteralText().includes(fragment);
    }

    if (Node.isTemplateHead(descendant) || Node.isTemplateMiddle(descendant) || Node.isTemplateTail(descendant)) {
      return descendant.getLiteralText().includes(fragment);
    }

    return false;
  });
}

export function hasTypeReference(node: Node, typeName: string): boolean {
  return node.getDescendantsOfKind(SyntaxKind.TypeReference).some((reference) => reference.getTypeName().getText() === typeName);
}

export function hasImportModuleSpecifier(sourceFile: SourceFile, marker: string): boolean {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const specifier = declaration.getModuleSpecifierValue() ?? "";
    return specifier.includes(marker);
  });
}

export function hasExportModuleSpecifier(sourceFile: SourceFile, marker: string): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => {
    const specifier = declaration.getModuleSpecifierValue() ?? "";
    return specifier.includes(marker);
  });
}

export function hasPropertyNamed(node: Node, propertyName: string): boolean {
  return node.getDescendants().some((descendant) => {
    return (Node.isPropertyAssignment(descendant) || Node.isShorthandPropertyAssignment(descendant))
      && descendant.getName() === propertyName;
  });
}

export function hasMethodNamed(node: Node, methodName: string): boolean {
  return node.getDescendantsOfKind(SyntaxKind.MethodDeclaration).some((method) => method.getName() === methodName);
}

export function hasCallExpression(node: Node, calleeName: string): boolean {
  return node.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression)
      ? expression.getText() === calleeName
      : Node.isPropertyAccessExpression(expression) && expression.getName() === calleeName;
  });
}

export function countCallExpressions(node: Node, calleeName: string): number {
  return node.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression)
      ? expression.getText() === calleeName
      : Node.isPropertyAccessExpression(expression) && expression.getName() === calleeName;
  }).length;
}

export function hasCallExpressionPath(node: Node, pathParts: string[]): boolean {
  return node.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expressionPath = flattenPropertyAccess(callExpression.getExpression());
    return expressionPath.length === pathParts.length && expressionPath.every((part, index) => part === pathParts[index]);
  });
}

export function hasCallExpressionWithStringLiteralArgument(node: Node, pathParts: string[], literalValue: string): boolean {
  return node.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expressionPath = flattenPropertyAccess(callExpression.getExpression());
    if (expressionPath.length !== pathParts.length || !expressionPath.every((part, index) => part === pathParts[index])) {
      return false;
    }

    return callExpression.getArguments().some((argument) => {
      return (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))
        && argument.getLiteralText() === literalValue;
    });
  });
}

export function hasNullishCoalescingLiteral(node: Node, literalValue: string): boolean {
  return node.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((expression) => {
    if (expression.getOperatorToken().getKind() !== SyntaxKind.QuestionQuestionToken) {
      return false;
    }

    const right = expression.getRight();
    return (Node.isStringLiteral(right) || Node.isNoSubstitutionTemplateLiteral(right))
      && right.getLiteralText() === literalValue;
  });
}

export function hasPropertyAccessName(node: Node, propertyName: string): boolean {
  return node.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => expression.getName() === propertyName);
}

export function hasPropertyAccessPath(node: Node, pathParts: string[]): boolean {
  return node.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => {
    const parts = flattenPropertyAccess(expression);
    return parts.length === pathParts.length && parts.every((part, index) => part === pathParts[index]);
  });
}

export function getFunctionLike(sourceFile: SourceFile, name: string): Node | null {
  const variableInitializer = sourceFile.getVariableDeclaration(name)?.getInitializer();
  if (variableInitializer && (Node.isArrowFunction(variableInitializer) || Node.isFunctionExpression(variableInitializer))) {
    return variableInitializer;
  }

  return sourceFile.getFunction(name) ?? null;
}

export function getClassMethod(sourceFile: SourceFile, className: string, methodName: string): MethodDeclaration | null {
  return sourceFile.getClass(className)?.getMethod(methodName) ?? null;
}

export function hasInterfaceMethod(sourceFile: SourceFile, interfaceName: string, methodName: string): boolean {
  return Boolean(sourceFile.getInterface(interfaceName)?.getMethod(methodName));
}

export function flattenPropertyAccess(node: Node | undefined): string[] {
  if (!node) {
    return [];
  }

  if (Node.isPropertyAccessExpression(node)) {
    return [...flattenPropertyAccess(node.getExpression()), node.getName()];
  }

  if (Node.isIdentifier(node)) {
    return [node.getText()];
  }

  if (node.getKind() === SyntaxKind.ThisKeyword) {
    return ["this"];
  }

  if (Node.isElementAccessExpression(node)) {
    const argument = node.getArgumentExpression();
    if (argument && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))) {
      return [...flattenPropertyAccess(node.getExpression()), argument.getLiteralText()];
    }
  }

  return [];
}

export function hasConsoleLog(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && flattenPropertyAccess(expression).join(".") === "console.log";
  });
}

export function hasAnyKeyword(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword).length > 0;
}
