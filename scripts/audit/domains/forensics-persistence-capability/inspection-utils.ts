import { Node, SyntaxKind, type ExportDeclaration, type ImportDeclaration, type SourceFile } from "ts-morph";

import { toRepoRelativePath } from "../../core/paths.js";

import { forensicsPersistenceInspectionConstants } from "./inspection-constants.js";

const {
  COMMENT_DIRECTIVES,
  FORBIDDEN_IMPORT_ROOTS,
  FORBIDDEN_PATH_SEGMENTS,
  FORBIDDEN_STORAGE_METHODS,
  ROOT,
  RUNTIME_ROOT,
} = forensicsPersistenceInspectionConstants;

const getResolvedModulePath = (declaration: ImportDeclaration | ExportDeclaration): string | null => {
  const sourceFile = declaration.getModuleSpecifierSourceFile();
  return sourceFile ? toRepoRelativePath(sourceFile.getFilePath()) : null;
};

const collectCommentTexts = (sourceFile: SourceFile): string[] => {
  const comments = new Set<string>();
  const nodes: Node[] = [sourceFile, ...sourceFile.getDescendants()];

  for (const node of nodes) {
    for (const range of node.getLeadingCommentRanges()) {
      comments.add(range.getText());
    }
    for (const range of node.getTrailingCommentRanges()) {
      comments.add(range.getText());
    }
  }

  return [...comments];
};

const hasCommentDirective = (sourceFile: SourceFile): boolean => {
  return collectCommentTexts(sourceFile).some((commentText) => {
    return [...COMMENT_DIRECTIVES].some((directive) => commentText.includes(directive));
  });
};

const flattenElementAccess = (node: Node): string[] => {
  if (!Node.isElementAccessExpression(node)) {
    return [];
  }

  const argument = node.getArgumentExpression();
  if (!argument || (!Node.isStringLiteral(argument) && !Node.isNoSubstitutionTemplateLiteral(argument))) {
    return [];
  }

  return [...flattenPropertyAccess(node.getExpression()), argument.getLiteralText()];
};

const flattenPropertyAccess = (node: Node | undefined): string[] => {
  if (!node) {
    return [];
  }
  if (Node.isPropertyAccessExpression(node)) {
    return [...flattenPropertyAccess(node.getExpression()), node.getName()];
  }
  if (Node.isIdentifier(node)) {
    return [node.getText()];
  }

  return flattenElementAccess(node);
};

const isPathUnderRoot = (relativePath: string, root: string): boolean => {
  return relativePath === root || relativePath.startsWith(`${root}/`);
};

const pathHasForbiddenSegment = (relativePath: string): boolean => {
  return relativePath
    .split("/")
    .filter((segment) => segment.length > 0)
    .some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment));
};

const hasDynamicImportOrRequire = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return expression.getKind() === SyntaxKind.ImportKeyword
      || (Node.isIdentifier(expression) && expression.getText() === "require");
  });
};

const hasExportStar = (sourceFile: SourceFile): boolean => {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.isNamespaceExport());
};

const isForbiddenCastType = (typeNode: Node | undefined): boolean => {
  if (!typeNode) {
    return false;
  }

  return typeNode.getKind() === SyntaxKind.AnyKeyword || typeNode.getText() === "unknown";
};

const hasForbiddenAsCast = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).some((expression) => {
    return isForbiddenCastType(expression.getTypeNode());
  });
};

const hasForbiddenTypeAssertion = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.TypeAssertionExpression).some((expression) => {
    return isForbiddenCastType(expression.getTypeNode());
  });
};

const hasForbiddenCast = (sourceFile: SourceFile): boolean => {
  return hasForbiddenAsCast(sourceFile) || hasForbiddenTypeAssertion(sourceFile);
};

const hasRecordUnknownType = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.TypeReference).some((typeReference) => {
    if (typeReference.getTypeName().getText() !== "Record") {
      return false;
    }

    const typeArguments = typeReference.getTypeArguments();
    return typeArguments.length === 2
      && typeArguments[0]?.getText() === "string"
      && typeArguments[1]?.getText() === "unknown";
  });
};

const getFunctionLine = (sourceFile: SourceFile, functionName: string): number => {
  const declaration = sourceFile.getFunction(functionName)
    ?? sourceFile.getVariableDeclaration(functionName)?.getInitializerIfKind(SyntaxKind.ArrowFunction)
    ?? sourceFile.getVariableDeclaration(functionName)?.getInitializerIfKind(SyntaxKind.FunctionExpression);
  return declaration?.getStartLineNumber() ?? 1;
};

const getIdentifierReferencePaths = (sourceFile: SourceFile, identifierName: string): Set<string> => {
  const declaration = sourceFile.getFunction(identifierName)
    ?? sourceFile.getVariableDeclaration(identifierName)
    ?? sourceFile.getClass(identifierName);
  if (!declaration) {
    return new Set();
  }

  return new Set(
    declaration.findReferencesAsNodes().map((node) => toRepoRelativePath(node.getSourceFile().getFilePath())),
  );
};

const symbolResolvesToPath = (identifier: Node | undefined, expectedPath: string): boolean => {
  if (!identifier || !Node.isIdentifier(identifier)) {
    return false;
  }

  const symbol = identifier.getSymbol();
  const resolved = symbol?.getAliasedSymbol() ?? symbol;
  return Boolean(resolved?.getDeclarations().some((declaration) => toRepoRelativePath(declaration.getSourceFile().getFilePath()) === expectedPath));
};

const sourceHasCallPath = (sourceFile: SourceFile, pathParts: readonly string[]): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expressionPath = flattenPropertyAccess(callExpression.getExpression());
    return expressionPath.length === pathParts.length && expressionPath.every((part, index) => part === pathParts[index]);
  });
};

const sourceUsesForbiddenImports = (sourceFile: SourceFile): boolean => {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const resolvedPath = getResolvedModulePath(declaration);
    return resolvedPath !== null && FORBIDDEN_IMPORT_ROOTS.some((root) => resolvedPath.startsWith(root));
  });
};

const childImplementationBypassesExecutor = (sourceFile: SourceFile): boolean => {
  const executeCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression)
      && expression.getText() === "executeForensicsChild"
      && symbolResolvesToPath(expression, `${RUNTIME_ROOT}/forensics-executor.ts`);
  });
  if (executeCalls.length !== 1) {
    return true;
  }

  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => {
    const path = flattenPropertyAccess(expression);
    return path.length === 3 && path[0] === "context" && path[1] === "recordStorage" && FORBIDDEN_STORAGE_METHODS.has(path[2] ?? "");
  });
};

const sourceUsesAnyKeyword = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword).length > 0;
};

const hasWriteGateSnapshotPath = (sourceFile: SourceFile): boolean => {
  const writeFunction = sourceFile.getFunction("writeForensicsEnvelope");
  return Boolean(writeFunction) && sourceHasCallPath(sourceFile, ["input", "recordStorage", "updateRuntimeSnapshot"]);
};

const hasExecutorOutputSchemaParse = (sourceFile: SourceFile): boolean => {
  return sourceHasCallPath(sourceFile, ["input", "child", "outputSchema", "parse"]);
};

const hasHashBuilderShape = (sourceFile: SourceFile): boolean => {
  const hashFunction = sourceFile.getFunction("buildCanonicalForensicsHash");
  const serializeFunction = sourceFile.getFunction("serializeCanonicalJson");
  if (!hashFunction || !serializeFunction) {
    return false;
  }

  const references = getIdentifierReferencePaths(sourceFile, "serializeCanonicalJson");
  return references.has(`${RUNTIME_ROOT}/forensics-hash-builder.ts`)
    && references.has(`${RUNTIME_ROOT}/forensics-idempotency.ts`)
    && sourceHasCallPath(sourceFile, ["createHash"]);
};

const indexLeaksInternals = (sourceFile: SourceFile): boolean => {
  if (hasExportStar(sourceFile)) {
    return true;
  }

  return sourceFile.getExportDeclarations().some((declaration) => {
    const target = getResolvedModulePath(declaration);
    if (!target) {
      return false;
    }

    return isPathUnderRoot(target, `${ROOT}/runtime`)
      || isPathUnderRoot(target, `${ROOT}/children`)
      || (isPathUnderRoot(target, `${ROOT}/shared`) && target !== `${ROOT}/schema.ts`);
  });
};

const abilityGroupTouchesStorage = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => {
    const path = flattenPropertyAccess(expression);
    return path.length >= 3
      && (path[0] === "context" || path[0] === "input")
      && (path[1] === "recordStorage" || path[1] === "artifactStorage");
  });
};

const abilityGroupHasThrow = (sourceFile: SourceFile): boolean => {
  const executeFunction = sourceFile.getVariableDeclaration("execute")?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  return Boolean(executeFunction?.getDescendantsOfKind(SyntaxKind.ThrowStatement).length);
};

export const forensicsPersistenceInspectionUtils = {
  abilityGroupHasThrow,
  abilityGroupTouchesStorage,
  childImplementationBypassesExecutor,
  getFunctionLine,
  getIdentifierReferencePaths,
  getResolvedModulePath,
  hasCommentDirective,
  hasDynamicImportOrRequire,
  hasExecutorOutputSchemaParse,
  hasForbiddenCast,
  hasHashBuilderShape,
  hasRecordUnknownType,
  hasWriteGateSnapshotPath,
  indexLeaksInternals,
  pathHasForbiddenSegment,
  sourceHasCallPath,
  sourceUsesAnyKeyword,
  sourceUsesForbiddenImports,
};