import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  Node,
  SyntaxKind,
  type Expression,
  type ImportDeclaration,
  type Project,
  type SourceFile,
} from "ts-morph";

import { pathFromRepoRoot, toRepoRelativePath } from "../../../core/paths.js";
import { createPhase } from "../../../core/result.js";
import type {
  Finding,
  InspectionClassification,
  InspectorPhase,
} from "../../../core/schema.js";
import { getAuditProject } from "../../../core/ts-morph.js";

export type DomAutomationValidationResult = {
  phase: InspectorPhase;
  findings: Finding[];
  coveredClauseIds: readonly string[];
};

export type DomAutomationAuditProject = {
  project: Project;
  sourceFiles: {
    dom: SourceFile[];
    domRuntime: SourceFile[];
    domContracts: SourceFile[];
    plugin: SourceFile[];
    visualMission: SourceFile[];
    browser: SourceFile[];
    muscleMemory: SourceFile[];
    acceptance: SourceFile[];
  };
};

const CODE_FILE_PATTERN = /\.(ts|tsx|js|mjs)$/;

const walkRepoFiles = (repoPath: string, acc: string[] = []): string[] => {
  const absolutePath = pathFromRepoRoot(repoPath);
  if (!existsSync(absolutePath)) {
    return acc;
  }
  for (const entry of readdirSync(absolutePath, { withFileTypes: true })) {
    const childAbsolutePath = join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      walkRepoFiles(toRepoRelativePath(childAbsolutePath), acc);
      continue;
    }
    if (entry.isFile() && CODE_FILE_PATTERN.test(entry.name)) {
      acc.push(childAbsolutePath);
    }
  }
  return acc;
};

const loadSourceFiles = (project: Project, repoPath: string): SourceFile[] =>
  walkRepoFiles(repoPath)
    .map((absolutePath) => project.addSourceFileAtPathIfExists(absolutePath))
    .filter((sourceFile): sourceFile is SourceFile => Boolean(sourceFile));

export const loadDomAutomationAuditProject = (): DomAutomationAuditProject => {
  const project = getAuditProject();
  return {
    project,
    sourceFiles: {
      dom: loadSourceFiles(project, "src/capabilities/dom-automation"),
      domRuntime: loadSourceFiles(project, "src/capabilities/dom-automation/runtime"),
      domContracts: loadSourceFiles(project, "src/capabilities/dom-automation/contracts"),
      plugin: loadSourceFiles(project, "src/plugins/amazon-invoice-upload"),
      visualMission: loadSourceFiles(project, "src/visual-mission"),
      browser: loadSourceFiles(project, "src/lib/browser"),
      muscleMemory: loadSourceFiles(project, "src/muscle-memory"),
      acceptance: loadSourceFiles(project, "scripts/acceptance"),
    },
  };
};

export const getSourceFileAtRepoPath = (
  project: Project,
  repoPath: string,
): SourceFile | null => project.addSourceFileAtPathIfExists(pathFromRepoRoot(repoPath)) ?? null;

export const isRepoPathWithin = (repoPath: string, ownerRoot: string): boolean =>
  repoPath === ownerRoot || repoPath.startsWith(`${ownerRoot}/`);

export const resolveModuleTargetPath = (
  importDeclaration: ImportDeclaration,
): string | null => {
  const target = importDeclaration.getModuleSpecifierSourceFile();
  return target ? toRepoRelativePath(target.getFilePath()) : null;
};

export const resolveImportedDeclarationPaths = (
  importDeclaration: ImportDeclaration,
): string[] => {
  const moduleTargetPath = resolveModuleTargetPath(importDeclaration);
  if (!moduleTargetPath) {
    return [];
  }
  const resolved = new Set<string>([moduleTargetPath]);
  const importClause = importDeclaration.getImportClause();
  const namedImports = importClause?.getNamedImports() ?? [];
  if (namedImports.length === 0) {
    return [...resolved];
  }
  const targetFile = importDeclaration.getModuleSpecifierSourceFile();
  if (!targetFile) {
    return [...resolved];
  }
  for (const namedImport of namedImports) {
    const exportName = namedImport.getNameNode().getText();
    const exported = targetFile.getExportedDeclarations().get(exportName) ?? [];
    for (const declaration of exported) {
      resolved.add(toRepoRelativePath(declaration.getSourceFile().getFilePath()));
    }
  }
  return [...resolved];
};

export const resolveStaticString = (expression: Node | undefined): string | null => {
  if (!expression) {
    return null;
  }
  if (Node.isStringLiteral(expression) || Node.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.getLiteralText();
  }
  if (Node.isTemplateExpression(expression)) {
    let resolved = expression.getHead().getLiteralText();
    for (const span of expression.getTemplateSpans()) {
      const segment = resolveStaticString(span.getExpression());
      if (segment == null) {
        return null;
      }
      resolved += segment;
      resolved += span.getLiteral().getLiteralText();
    }
    return resolved;
  }
  if (Node.isBinaryExpression(expression) && expression.getOperatorToken().getKind() === SyntaxKind.PlusToken) {
    const left = resolveStaticString(expression.getLeft());
    const right = resolveStaticString(expression.getRight());
    return left != null && right != null ? `${left}${right}` : null;
  }
  if (Node.isParenthesizedExpression(expression)) {
    return resolveStaticString(expression.getExpression());
  }
  return null;
};

export const collectStringLiteralNodes = (sourceFile: SourceFile): Array<{ text: string; line: number }> => {
  const literals: Array<{ text: string; line: number }> = [];
  sourceFile.forEachDescendant((node) => {
    if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
      literals.push({ text: node.getLiteralText(), line: node.getStartLineNumber() });
      return;
    }
    if (Node.isTemplateExpression(node)) {
      const resolved = resolveStaticString(node);
      if (resolved != null) {
        literals.push({ text: resolved, line: node.getStartLineNumber() });
      }
    }
    if (Node.isBinaryExpression(node) && node.getOperatorToken().getKind() === SyntaxKind.PlusToken) {
      const resolved = resolveStaticString(node);
      if (resolved != null) {
        literals.push({ text: resolved, line: node.getStartLineNumber() });
      }
    }
  });
  return literals;
};

export const findNamedImport = (
  sourceFile: SourceFile,
  localName: string,
): ImportDeclaration | null => {
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const importClause = importDeclaration.getImportClause();
    const namedImport = importClause?.getNamedImports().find((candidate) => {
      const alias = candidate.getAliasNode()?.getText();
      return alias === localName || candidate.getNameNode().getText() === localName;
    });
    if (namedImport) {
      return importDeclaration;
    }
  }
  return null;
};

export const hasIdentifierCall = (sourceFile: SourceFile, identifierName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === identifierName;
  });

export const objectLiteralPropertyNames = (expression: Node | undefined): string[] => {
  if (!expression || !Node.isObjectLiteralExpression(expression)) {
    return [];
  }
  return expression.getProperties().flatMap((property) => {
    if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
      const nameNode = property.getNameNode();
      if (Node.isComputedPropertyName(nameNode)) {
        const computed = resolveStaticString(nameNode.getExpression());
        return computed ? [computed] : [];
      }
      return [nameNode.getText().replace(/^['"]|['"]$/g, "")];
    }
    return [];
  });
};

export const buildValidationResult = (input: {
  name: string;
  findings: Finding[];
  coveredClauseIds: readonly string[];
  passSummary: string;
  failSummary: string;
  failureClassification?: InspectionClassification;
}): DomAutomationValidationResult => {
  const passed = input.findings.length === 0;
  return {
    findings: input.findings,
    coveredClauseIds: [...new Set(input.coveredClauseIds)],
    phase: createPhase(
      input.name,
      passed ? "PASS" : input.failureClassification ?? "CODE VIOLATION",
      passed,
      passed ? input.passSummary : input.failSummary,
    ),
  };
};