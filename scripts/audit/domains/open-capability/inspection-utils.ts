import { Node, SyntaxKind, type Identifier, type ObjectLiteralExpression, type Project, type SourceFile } from "ts-morph";

import { toRepoRelativePath } from "../../core/paths.js";
import { getSourceFileOrThrow } from "../_shared/ast-helpers.js";

import { openInspectionConstants } from "./inspection-constants.js";

const {
  CLOCK_PATH,
  FORBIDDEN_COMMENT_DIRECTIVES,
  FORBIDDEN_IMPORT_MARKERS,
  OPEN_ROOT,
} = openInspectionConstants;

const getOpenSources = (project: Project): SourceFile[] => {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${OPEN_ROOT}/`));
};

const getOpenSourceOrThrow = (project: Project, repoRelativePath: string): SourceFile => {
  return getSourceFileOrThrow(project, repoRelativePath);
};

const unwrapExpression = (node: Node | undefined): Node | undefined => {
  if (!node) {
    return undefined;
  }
  if (Node.isAsExpression(node) || Node.isSatisfiesExpression(node) || Node.isParenthesizedExpression(node)) {
    return unwrapExpression(node.getExpression());
  }
  return node;
};

const getRegistryEntries = (sourceFile: SourceFile): ObjectLiteralExpression[] => {
  const declaration = sourceFile.getVariableDeclaration("OPEN_CHILDREN");
  const arrayLiteral = unwrapExpression(declaration?.getInitializer());
  return Node.isArrayLiteralExpression(arrayLiteral)
    ? arrayLiteral.getElements().filter(Node.isObjectLiteralExpression)
    : [];
};

const hasStrictSuccessStatusCheck = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((expression) => {
    if (expression.getOperatorToken().getKind() !== SyntaxKind.EqualsEqualsEqualsToken) {
      return false;
    }

    const left = expression.getLeft();
    const right = expression.getRight();
    return Node.isPropertyAccessExpression(left)
      && left.getName() === "status"
      && Node.isStringLiteral(right)
      && right.getLiteralText() === "success";
  });
};

const hasReturnedObjectProperty = (sourceFile: SourceFile, propertyName: string): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.ReturnStatement).some((returnStatement) => {
    const expression = returnStatement.getExpression();
    if (!expression || !Node.isCallExpression(expression)) {
      return false;
    }

    const argument = expression.getArguments()[0];
    return Node.isObjectLiteralExpression(argument)
      && argument.getProperties().some((property) => {
        return (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) && property.getName() === propertyName;
      });
  });
};

const getObjectPropertyNames = (objectLiteral: ObjectLiteralExpression): Set<string> => {
  return new Set(
    objectLiteral.getProperties()
      .filter((property) => Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property))
      .map((property) => property.getName()),
  );
};

const collectComments = (sourceFile: SourceFile): string[] => {
  const comments = new Set<string>();
  const nodes = [sourceFile, ...sourceFile.getDescendants()];

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
  return collectComments(sourceFile).some((comment) => FORBIDDEN_COMMENT_DIRECTIVES.some((directive) => comment.includes(directive)));
};

const hasDateUsageOutsideClock = (sourceFile: SourceFile): boolean => {
  const repoPath = toRepoRelativePath(sourceFile.getFilePath());
  if (repoPath === CLOCK_PATH) {
    return false;
  }

  return sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "Date")
    || sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((expression) => {
      const callee = expression.getExpression();
      return Node.isPropertyAccessExpression(callee) && callee.getExpression().getText() === "Date" && callee.getName() === "now";
    });
};

const hasDynamicImport = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((expression) => expression.getExpression().getKind() === SyntaxKind.ImportKeyword);
};

const hasRequireCall = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((expression) => {
    const callee = expression.getExpression();
    return Node.isIdentifier(callee) && callee.getText() === "require";
  });
};

const hasCookieRead = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendants().some((node) => {
    if (Node.isIdentifier(node)) {
      const text = node.getText().toLowerCase();
      return text === "cookie" || text === "cookies";
    }
    if (!Node.isPropertyAccessExpression(node)) {
      return false;
    }

    const name = node.getName().toLowerCase();
    return name === "cookie" || name === "cookies" || name === "storagestate";
  });
};

const resolveModuleSourcePath = (declaration: import("ts-morph").ImportDeclaration | import("ts-morph").ExportDeclaration): string | null => {
  const sourceFile = declaration.getModuleSpecifierSourceFile();
  return sourceFile ? toRepoRelativePath(sourceFile.getFilePath()) : null;
};

const getFunctionIdentifier = (sourceFile: SourceFile, functionName: string): Identifier | null => {
  return sourceFile.getFunction(functionName)?.getNameNode() ?? null;
};

const hasUnknownAsChain = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).some((expression) => expression.getExpression().getText().includes(" as unknown"));
};

const propertyFabricatesAllowDecision = (property: import("ts-morph").PropertyAssignment): boolean => {
  const initializer = property.getInitializer();
  return property.getName() === "status" && Node.isStringLiteral(initializer) && initializer.getLiteralText() === "allow";
};

const propertyFabricatesTargetProfile = (property: import("ts-morph").PropertyAssignment): boolean => {
  const initializer = property.getInitializer();
  if (property.getName() !== "targetProfileRef" || !initializer) {
    return false;
  }
  if (Node.isStringLiteral(initializer) && initializer.getLiteralText().includes("open-target-profile:")) {
    return true;
  }
  return initializer.getText() !== "null";
};

const hasDispatchFailureFabrication = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => {
    return propertyFabricatesAllowDecision(property) || propertyFabricatesTargetProfile(property);
  });
};

const propertyMatchesStringLiteral = (property: import("ts-morph").ObjectLiteralElementLike, name: string, value: string): boolean => {
  if (!Node.isPropertyAssignment(property)) {
    return false;
  }

  const initializer = property.getInitializer();
  return property.getName() === name && Node.isStringLiteral(initializer) && initializer.getLiteralText() === value;
};

const objectMatchesStatusClassification = (objectLiteral: ObjectLiteralExpression, status: string, classification: string): boolean => {
  const properties = objectLiteral.getProperties();
  const statusMatches = properties.some((property) => propertyMatchesStringLiteral(property, "status", status));
  const classificationMatches = properties.some((property) => propertyMatchesStringLiteral(property, "classification", classification));
  return statusMatches && classificationMatches;
};

const hasStatusClassificationObject = (sourceFile: SourceFile, status: string, classification: string): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((objectLiteral) => {
    return objectMatchesStatusClassification(objectLiteral, status, classification);
  });
};

const hasForbiddenResolvedImport = (sourceFile: SourceFile): boolean => {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const resolvedPath = resolveModuleSourcePath(declaration);
    return resolvedPath !== null && FORBIDDEN_IMPORT_MARKERS.some((marker) => resolvedPath.includes(marker));
  });
};

export const openInspectionUtils = {
  getFunctionIdentifier,
  getObjectPropertyNames,
  getOpenSourceOrThrow,
  getOpenSources,
  getRegistryEntries,
  hasCommentDirective,
  hasCookieRead,
  hasDateUsageOutsideClock,
  hasDispatchFailureFabrication,
  hasDynamicImport,
  hasForbiddenResolvedImport,
  hasRequireCall,
  hasReturnedObjectProperty,
  hasStatusClassificationObject,
  hasStrictSuccessStatusCheck,
  hasUnknownAsChain,
  resolveModuleSourcePath,
};