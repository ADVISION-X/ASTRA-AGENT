import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createAuditProject } from "../_shared/ast-helpers.js";
import { hasStringLiteral } from "../_shared/ast-literal-queries.js";

import { geometryGuardInspectionConfig } from "./inspection-constants.js";

const { FORBIDDEN_IDENTIFIERS, FORBIDDEN_IMPORT_SEGMENTS, REQUIRED_CHILDREN, ROOT } = geometryGuardInspectionConfig;

const getSourceFile = (project: ReturnType<typeof createAuditProject>, repoRelativePath: string): SourceFile | null => {
  return project.getSourceFile(pathFromRepoRoot(repoRelativePath)) ?? null;
};

const getStringLiterals = (sourceFile: SourceFile): Set<string> => {
  const values = new Set<string>();
  for (const node of sourceFile.getDescendants()) {
    if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
      values.add(node.getLiteralText());
    }
  }
  return values;
};

const hasForbiddenIdentifier = (sourceFile: SourceFile): boolean => {
  return FORBIDDEN_IDENTIFIERS.some((identifier) => {
    return sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((node) => node.getText() === identifier);
  });
};

const hasThrowStatement = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0;
};

const hasVerifySymbol = (sourceFile: SourceFile): boolean => {
  const functionNames = sourceFile.getFunctions().map((fn) => fn.getName() ?? "");
  const variableNames = sourceFile.getVariableDeclarations().map((declaration) => declaration.getName());
  return [...functionNames, ...variableNames].some((name) => name.startsWith("verify"));
};

const hasClampEscape = (sourceFile: SourceFile): boolean => {
  const text = sourceFile.getFullText();
  return sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((node) => node.getText().toLowerCase().includes("clamp"))
    || hasStringLiteral(sourceFile, "clamp")
    || hasStringLiteral(sourceFile, "clamped")
    || /Math\.(max|min)\(\s*1\s*,\s*roundValue/.test(text);
};

const hasDateEscape = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "Date")
    || sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => {
      const left = expression.getExpression().getText();
      const right = expression.getName();
      return left === "Date" && (right === "parse" || right === "now");
    });
};

const hasTextEscape = (sourceFile: SourceFile): boolean => {
  const text = sourceFile.getFullText();
  return text.includes("@ts-ignore") || text.includes("@ts-expect-error") || text.includes(" as any") || text.includes("as unknown as");
};

const hasExportStar = (sourceFile: SourceFile): boolean => {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.isNamespaceExport()) || /(^|\n)\s*export\s+\*/.test(sourceFile.getFullText());
};

const collectGeometryFiles = (project: ReturnType<typeof createAuditProject>): SourceFile[] => {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${ROOT}/`));
};

const getImportViolations = (files: SourceFile[]): string[] => {
  return files.flatMap((sourceFile) => {
    const relativePath = toRepoRelativePath(sourceFile.getFilePath());
    return sourceFile.getImportDeclarations().flatMap((declaration) => {
      const specifier = declaration.getModuleSpecifierValue() ?? "";
      return FORBIDDEN_IMPORT_SEGMENTS.some((segment) => specifier.includes(segment)) ? [relativePath] : [];
    });
  });
};

const childImplementationPath = (childId: typeof REQUIRED_CHILDREN[number]): string => {
  return `${ROOT}/children/${childId}/implementation.ts`;
};

export const geometryGuardInspectionUtils = {
  childImplementationPath,
  collectGeometryFiles,
  getImportViolations,
  getSourceFile,
  getStringLiterals,
  hasClampEscape,
  hasDateEscape,
  hasExportStar,
  hasForbiddenIdentifier,
  hasTextEscape,
  hasThrowStatement,
  hasVerifySymbol,
};