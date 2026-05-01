import { Node, SyntaxKind, type ObjectLiteralElementLike, type SourceFile } from "ts-morph";

import { flattenPropertyAccess } from "../_shared/ast-helpers.js";

const SENSITIVE_EXPORT_TOKENS = [
  "cookie",
  "cookiejar",
  "access_token",
  "refresh_token",
  "session_token",
  "auth_token",
  "password",
] as const;

const LOCAL_HOST_LITERAL = "127.0.0.1";

const isSensitiveExportName = (name: string): boolean => {
  const normalizedName = name.toLowerCase().replaceAll(/[-\s]/g, "_");
  return SENSITIVE_EXPORT_TOKENS.some((token) => normalizedName.includes(token));
};

const hasSensitiveExport = (sourceFile: SourceFile): boolean =>
  [...sourceFile.getExportedDeclarations().keys()].some(isSensitiveExportName);

const hasLocalHostBinding = (serverSource: SourceFile): boolean =>
  serverSource.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((expression) => {
    if (expression.getOperatorToken().getKind() !== SyntaxKind.QuestionQuestionToken) {
      return false;
    }

    const right = expression.getRight();
    return flattenPropertyAccess(expression.getLeft()).join(".") === "process.env.GRASSEYE_HOST"
      && Node.isStringLiteral(right)
      && right.getLiteralText() === LOCAL_HOST_LITERAL;
  });

const isArtifactsDirInitializer = (sourceFile: SourceFile): boolean => {
  const initializer = sourceFile.getFunction("createEvidenceStoreInternals")?.getVariableDeclaration("artifactsDir")?.getInitializer();
  if (!initializer || !Node.isCallExpression(initializer)) {
    return false;
  }

  const [firstArgument, secondArgument] = initializer.getArguments();
  return flattenPropertyAccess(initializer.getExpression()).join(".") === "path.join"
    && Node.isIdentifier(firstArgument)
    && firstArgument.getText() === "dataDir"
    && Node.isStringLiteral(secondArgument)
    && secondArgument.getLiteralText() === "artifacts";
};

const hasReturnedBinding = (property: ObjectLiteralElementLike | undefined, bindingName: string): boolean => {
  if (!property) {
    return false;
  }

  if (Node.isShorthandPropertyAssignment(property)) {
    return property.getName() === bindingName;
  }

  const initializer = Node.isPropertyAssignment(property) ? property.getInitializer() : undefined;
  return Node.isPropertyAssignment(property)
    && property.getName() === bindingName
    && initializer !== undefined
    && Node.isIdentifier(initializer)
    && initializer.getText() === bindingName;
};

const hasLocalEvidenceStorage = (evidenceStoreSource: SourceFile): boolean => {
  const createInternals = evidenceStoreSource.getFunction("createEvidenceStoreInternals");
  if (!createInternals || !isArtifactsDirInitializer(evidenceStoreSource)) {
    return false;
  }

  const objectLiteral = createInternals
    .getDescendantsOfKind(SyntaxKind.ReturnStatement)
    .map((statement) => statement.getExpression())
    .find((expression): expression is import("ts-morph").ObjectLiteralExpression => Node.isObjectLiteralExpression(expression));

  if (!objectLiteral) {
    return false;
  }

  const properties = objectLiteral.getProperties();
  const artifactsDirProperty = properties.find((property) =>
    (Node.isShorthandPropertyAssignment(property) || Node.isPropertyAssignment(property))
      && property.getName() === "artifactsDir",
  );
  const dataDirProperty = properties.find((property) =>
    (Node.isShorthandPropertyAssignment(property) || Node.isPropertyAssignment(property))
      && property.getName() === "dataDir",
  );

  return hasReturnedBinding(artifactsDirProperty, "artifactsDir")
    && hasReturnedBinding(dataDirProperty, "dataDir");
};

export const hasLocalSecurityBoundary = (serverSource: SourceFile, evidenceStoreSource: SourceFile): boolean =>
  hasLocalHostBinding(serverSource)
  && hasLocalEvidenceStorage(evidenceStoreSource)
  && !hasSensitiveExport(evidenceStoreSource);
