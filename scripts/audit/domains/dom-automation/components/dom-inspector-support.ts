import { existsSync } from "node:fs";
import { Node, SyntaxKind, type Expression, type Project, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../../shared/ast-node-identity.js";
import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";

export type DomFindingCollector = {
  findings: InspectorFinding[];
  push(input: {
    checkId: string;
    lawId: string;
    message: string;
    filePath?: string;
    evidence?: string;
  }): void;
};

export const createDomFindingCollector = (): DomFindingCollector => {
  const findings: InspectorFinding[] = [];
  const keys = new Set<string>();
  return {
    findings,
    push(input) {
      const key = `${input.checkId}:${input.filePath ?? ""}:${input.evidence ?? ""}:${input.message}`;
      if (keys.has(key)) return;
      keys.add(key);
      findings.push(createFinding(input));
    },
  };
};

export const sourceFileByRepoPath = (project: Project, repoPath: string): SourceFile | undefined =>
  project.getSourceFile((sourceFile) => sourceFile.getFilePath().endsWith(repoPath));

export const repoFileExists = (repoPath: string): boolean => existsSync(resolveFromRepo(repoPath));

export const exportedNames = (sourceFile: SourceFile): Set<string> => {
  const names = new Set<string>();
  for (const declaration of sourceFile.getExportDeclarations()) {
    for (const namedExport of declaration.getNamedExports()) names.add(namedExport.getName());
  }
  return names;
};

export const runtimeExportNames = (sourceFile: SourceFile): Set<string> => {
  const names = new Set<string>();
  for (const declaration of sourceFile.getExportDeclarations()) {
    const modulePath = declaration.getModuleSpecifierValue();
    if (!modulePath?.startsWith("./runtime/")) continue;
    for (const namedExport of declaration.getNamedExports()) names.add(namedExport.getName());
  }
  return names;
};

export const zEnumValues = (sourceFile: SourceFile, declarationName: string): string[] => {
  const initializer = unwrapZodCall(sourceFile.getVariableDeclaration(declarationName)?.getInitializer());
  if (!initializer || !Node.isCallExpression(initializer)) return [];
  const [firstArg] = initializer.getArguments();
  if (!firstArg || !Node.isArrayLiteralExpression(firstArg)) return [];
  return firstArg.getElements().flatMap((element) =>
    Node.isStringLiteral(element) ? [element.getLiteralValue()] : [],
  );
};

export const zObjectPropertyNames = (sourceFile: SourceFile, declarationName: string): Set<string> => {
  const initializer = unwrapZodCall(sourceFile.getVariableDeclaration(declarationName)?.getInitializer());
  const call = initializer && Node.isCallExpression(initializer) ? initializer : undefined;
  const [firstArg] = call?.getArguments() ?? [];
  if (!firstArg || !Node.isObjectLiteralExpression(firstArg)) return new Set();
  return new Set(firstArg.getProperties().flatMap((property) =>
    Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)
      ? [property.getName()]
      : [],
  ));
};

const unwrapZodCall = (expression: Expression | undefined): Expression | undefined => {
  if (!expression || !Node.isCallExpression(expression)) return expression;
  const callExpression = expression.getExpression();
  if (!Node.isPropertyAccessExpression(callExpression)) return expression;
  if (callExpression.getName() !== "strict") return expression;
  return unwrapZodCall(callExpression.getExpression());
};

export const hasIdentifier = (sourceFile: SourceFile, name: string): boolean =>
  sourceFile.getDescendants().some((node) => Node.isIdentifier(node) && astIdentifierName(node) === name);

export const hasSourceToken = (sourceFile: SourceFile, value: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralValue() === value)
  || sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).some((literal) => literal.getLiteralValue() === value)
  || sourceFile.getDescendantsOfKind(SyntaxKind.TemplateHead).some((literal) => literal.getLiteralText().includes(value))
  || sourceFile.getDescendantsOfKind(SyntaxKind.TemplateMiddle).some((literal) => literal.getLiteralText().includes(value))
  || sourceFile.getDescendantsOfKind(SyntaxKind.TemplateTail).some((literal) => literal.getLiteralText().includes(value));
