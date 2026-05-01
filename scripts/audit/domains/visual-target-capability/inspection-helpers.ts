import { Node, SyntaxKind, type ImportDeclaration, type Project, type SourceFile, type TypeChecker } from "ts-morph";

import { createFinding, createPhase, toRepoRelativePath, type Finding, type InspectorPhase } from "./inspection-core.js";
import { flattenPropertyAccess } from "./inspection-ast-helpers.js";
import { ALLOWED_DATE_FILES, visualTargetInspectionConstants as config } from "./inspection-constants.js";

export type AttackOutcome = { findings: Finding[]; phase: InspectorPhase };

export const toLine = (node: Node | undefined): number => node?.getStartLineNumber() ?? 1;

export const toRootRelative = (sourceFile: SourceFile): string => toRepoRelativePath(sourceFile.getFilePath());

export const createViolation = (input: {
  lawId: string;
  file: string;
  line?: number;
  severity?: "error" | "fatal";
  message: string;
  detail?: string | undefined;
  hint?: string | undefined;
}): Finding => {
  return createFinding({
    lawId: input.lawId,
    file: input.file,
    line: input.line ?? 1,
    severity: input.severity ?? "error",
    message: input.message,
    ...(input.detail === undefined ? {} : { detail: input.detail }),
    ...(input.hint === undefined ? {} : { hint: input.hint }),
  });
};

export const createAttackPhase = (name: string, findings: Finding[], passSummary: string, failSummary: string): InspectorPhase => {
  const passed = findings.length === 0;
  return createPhase(name, passed ? "PASS" : "CODE VIOLATION", passed, passed ? passSummary : failSummary);
};

export const getVisualTargetSourceFiles = (project: Project): SourceFile[] => {
  return project.getSourceFiles().filter((sourceFile) => toRootRelative(sourceFile).startsWith(`${config.ROOT}/`));
};

export const hasWildcardExport = (sourceFile: SourceFile): boolean => {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.getNamedExports().length === 0);
};

export const getIllegalDateNodes = (sourceFile: SourceFile): Node[] => {
  const illegalCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const path = flattenPropertyAccess(callExpression.getExpression());
    return path.length === 2 && path[0] === "Date" && path[1] === "parse";
  });
  const illegalNewExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).filter((newExpression) => {
    const expression = newExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "Date";
  });
  return [...illegalCalls, ...illegalNewExpressions];
};

export const getUnknownCastEscapes = (sourceFile: SourceFile): Node[] => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).filter((asExpression) => {
    const currentType = asExpression.getTypeNode()?.getText();
    if (currentType === "any") {
      return true;
    }

    const expression = asExpression.getExpression();
    return Node.isAsExpression(expression) && expression.getTypeNode()?.getText() === "unknown";
  });
};

export const getDynamicImportEscapes = (sourceFile: SourceFile): Node[] => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword);
};

export const getRequireEscapes = (sourceFile: SourceFile): Node[] => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "require";
  });
};

export const getCommentEscapeMarkers = (sourceFile: SourceFile): string[] => {
  const text = sourceFile.getFullText();
  return ["@ts-ignore", "@ts-expect-error", "eslint-disable"].filter((marker) => text.includes(marker));
};

export const extractImportResolutionDetail = (typeChecker: TypeChecker, declaration: ImportDeclaration): string | undefined => {
  const targetNode = declaration.getDefaultImport() ?? declaration.getNamespaceImport() ?? declaration.getNamedImports()[0]?.getNameNode();
  if (!targetNode) {
    return undefined;
  }

  const symbol = typeChecker.getSymbolAtLocation(targetNode);
  if (!symbol) {
    return undefined;
  }

  const aliasedSymbol = symbol.getAliasedSymbol();
  const referenceNodes = Node.isIdentifier(targetNode) ? targetNode.findReferencesAsNodes() : [];
  const referencePaths = [...new Set<string>(referenceNodes.map((node) => toRootRelative(node.getSourceFile())))].sort((left, right) => left.localeCompare(right));
  return `symbol=${symbol.getName()} aliased=${aliasedSymbol?.getName() ?? "none"} refs=${referencePaths.join(", ")}`;
};

export const hasCoordinateSpaceExclusion = (sourceFile: SourceFile, schemaName: string, exclusions: readonly string[]): boolean => {
  const declaration = sourceFile.getVariableDeclaration(schemaName);
  if (!declaration) {
    return false;
  }

  return declaration.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "exclude") {
      return false;
    }
    if (expression.getExpression().getText() !== "VisualTargetCoordinateSpaceSchema") {
      return false;
    }

    const [firstArgument] = callExpression.getArguments();
    if (!firstArgument || !Node.isArrayLiteralExpression(firstArgument)) {
      return false;
    }

    const values = new Set(firstArgument.getElements().flatMap((element) => Node.isStringLiteral(element) ? [element.getLiteralText()] : []));
    return exclusions.every((value) => values.has(value));
  });
};

const getObjectLiteralPropertyNames = (node: Node | undefined): Set<string> => {
  if (!node || !Node.isObjectLiteralExpression(node)) {
    return new Set();
  }

  return new Set(node.getProperties().flatMap((property) => {
    return Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property) ? [property.getName()] : [];
  }));
};

const collectZodShapePropertyNames = (node: Node | undefined): Set<string> => {
  if (!node || !Node.isCallExpression(node)) {
    return new Set();
  }

  const expression = node.getExpression();
  if (Node.isPropertyAccessExpression(expression)) {
    if (expression.getName() === "strict" || expression.getName() === "superRefine") {
      return collectZodShapePropertyNames(expression.getExpression());
    }
    if (expression.getName() === "extend") {
      const base = collectZodShapePropertyNames(expression.getExpression());
      const extension = getObjectLiteralPropertyNames(node.getArguments()[0]);
      for (const propertyName of extension) {
        base.add(propertyName);
      }
      return base;
    }
  }

  return getObjectLiteralPropertyNames(node.getArguments()[0]);
};

export const getZodShapePropertyNames = (sourceFile: SourceFile, declarationName: string): Set<string> => {
  return collectZodShapePropertyNames(sourceFile.getVariableDeclaration(declarationName)?.getInitializer());
};

export const canUseDateInFile = (relativePath: string): boolean => {
  return ALLOWED_DATE_FILES.has(relativePath);
};