import path from "node:path";

import { Node, Project, SyntaxKind, type Expression, type SourceFile } from "ts-morph";

import { pathFromRepoRoot } from "../../core/paths.js";
import { getExpressionPath } from "../../core/ts-morph.js";

import { localAppShellInspectionConstants as config } from "./inspection-constants.js";

export const createStartupProject = (): Project => {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true },
  });

  project.addSourceFileAtPath(pathFromRepoRoot(config.STARTUP_ENTRY));
  for (const helperPath of config.STARTUP_HELPERS) {
    project.addSourceFileAtPath(pathFromRepoRoot(helperPath));
  }

  return project;
};

export const hasNamedImport = (sourceFile: SourceFile, moduleSpecifier: string, importedName: string): boolean => {
  return sourceFile.getImportDeclarations().some((declaration) => {
    return declaration.getModuleSpecifierValue() === moduleSpecifier
      && declaration.getNamedImports().some((specifier) => specifier.getName() === importedName);
  });
};

export const getIdentifierCall = (sourceFile: SourceFile, identifierName: string) => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === identifierName;
  });
};

export const getIdentifierCallWithin = (node: Node, identifierName: string) => {
  return node.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === identifierName;
  });
};

export const getResolvedRelativeImport = (relativeFilePath: string, moduleSpecifier: string): string | null => {
  if (!moduleSpecifier.startsWith(".")) {
    return null;
  }

  const resolvedPath = path.normalize(path.join(path.dirname(relativeFilePath), moduleSpecifier));
  return resolvedPath.replace(/\\/g, "/");
};

export const getPropertyPath = (initializer: Expression | undefined): string[] => {
  return initializer ? getExpressionPath(initializer) : [];
};