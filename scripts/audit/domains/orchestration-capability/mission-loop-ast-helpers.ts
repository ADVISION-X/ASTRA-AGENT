import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type CallExpression,
  type FunctionDeclaration,
  type FunctionExpression,
  type ObjectLiteralExpression,
  type SourceFile,
} from "ts-morph";

const getObjectLiteralArgument = (callExpression: CallExpression): ObjectLiteralExpression | undefined => {
  const objectLiteral = callExpression.getArguments().find((argument) => Node.isObjectLiteralExpression(argument));
  return objectLiteral && Node.isObjectLiteralExpression(objectLiteral) ? objectLiteral : undefined;
};

const getPropertyInitializerText = (objectLiteral: ObjectLiteralExpression, propertyName: string): string => {
  const property = objectLiteral.getProperty(propertyName);
  return property && Node.isPropertyAssignment(property)
    ? property.getInitializer()?.getText() ?? ""
    : "";
};

const isMissionStateCall = (callExpression: CallExpression): boolean => {
  const expression = callExpression.getExpression();
  return Node.isIdentifier(expression) && expression.getText() === "toMissionControlState";
};

const hasRuntimeProofRefs = (objectLiteral: ObjectLiteralExpression): boolean => {
  const lastRuntimeProofRefText = getPropertyInitializerText(objectLiteral, "lastRuntimeProofRef");
  const runtimeProofRefsText = getPropertyInitializerText(objectLiteral, "runtimeProofRefs");
  return lastRuntimeProofRefText.includes("runtimeProofId") && runtimeProofRefsText.includes("runtimeProofId");
};

const hasMissionStateProofClosure = (callExpression: CallExpression): boolean => {
  if (!isMissionStateCall(callExpression)) {
    return false;
  }

  const objectLiteral = getObjectLiteralArgument(callExpression);
  return objectLiteral ? hasRuntimeProofRefs(objectLiteral) : false;
};

type NamedFunctionLike = ArrowFunction | FunctionDeclaration | FunctionExpression;

export const getNamedFunctionLike = (sourceFile: SourceFile, functionName: string): NamedFunctionLike | undefined => {
  const functionDeclaration = sourceFile.getFunction(functionName);
  if (functionDeclaration) {
    return functionDeclaration;
  }

  const variableDeclaration = sourceFile.getVariableDeclaration(functionName);
  const initializer = variableDeclaration?.getInitializer();
  return initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))
    ? initializer
    : undefined;
};

export const getTypeAliasPropertyNames = (sourceFile: SourceFile, aliasName: string): Set<string> => {
  const typeAlias = sourceFile.getTypeAlias(aliasName);
  const typeNode = typeAlias?.getTypeNode();
  if (!typeNode || !Node.isTypeLiteral(typeNode)) {
    return new Set();
  }

  return new Set(
    typeNode
      .getProperties()
      .filter((property) => Node.isPropertySignature(property))
      .map((property) => property.getName()),
  );
};

export const hasCallObjectProperty = (sourceFile: SourceFile, callName: string, propertyName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== callName) {
      return false;
    }

    const [firstArgument] = callExpression.getArguments();
    return Boolean(firstArgument && Node.isObjectLiteralExpression(firstArgument) && firstArgument.getProperty(propertyName));
  });

export const getRuntimeEventTypes = (sourceFile: SourceFile): Set<string> =>
  new Set(
    sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((callExpression) => {
        const expression = callExpression.getExpression();
        return Node.isIdentifier(expression) && expression.getText() === "recordMissionRuntimeEvent";
      })
      .flatMap((callExpression) => {
        const objectLiteral = getObjectLiteralArgument(callExpression);
        const property = objectLiteral?.getProperty("eventType");
        if (!property || !Node.isPropertyAssignment(property)) {
          return [];
        }

        const initializer = property.getInitializer();
        return initializer && (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer))
          ? [initializer.getLiteralText()]
          : [];
      }),
  );

export const functionContainsStringLiterals = (sourceFile: SourceFile, functionName: string, literalValues: string[]): boolean => {
  const fn = getNamedFunctionLike(sourceFile, functionName);
  if (!fn) {
    return false;
  }

  const stringLiterals = new Set(
    fn
      .getDescendantsOfKind(SyntaxKind.StringLiteral)
      .map((literal) => literal.getLiteralText()),
  );

  return literalValues.every((literalValue) => stringLiterals.has(literalValue));
};

export const hasSuccessProofClosure = (sourceFile: SourceFile): boolean => {
  const fn = getNamedFunctionLike(sourceFile, "buildTransitionSuccessOutcome");
  if (!fn) {
    return false;
  }

  return fn.getDescendantsOfKind(SyntaxKind.CallExpression).some(hasMissionStateProofClosure);
};