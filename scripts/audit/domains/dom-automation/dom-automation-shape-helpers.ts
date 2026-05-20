import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { getSourceFileAtRepoPath } from "./components/collect-dom-automation-project.js";
import { hasIdentifierCall, objectLiteralPropertyNames } from "./components/dom-automation-static-strings.js";
import type { DomAutomationBinaryCheckContext } from "./dom-automation-binary-types.js";

export { hasIdentifierCall };

export const sourceFile = (context: DomAutomationBinaryCheckContext, repoPath: string): SourceFile | null =>
  getSourceFileAtRepoPath(context.auditProject.project, repoPath);

export const variableFields = (file: SourceFile | null, variableName: string): Set<string> => {
  if (!file) {
    return new Set<string>();
  }
  const declaration = file.getVariableDeclaration(variableName);
  if (!declaration) {
    return new Set<string>();
  }
  const fields = new Set<string>();
  for (const objectLiteral of declaration.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
    for (const fieldName of objectLiteralPropertyNames(objectLiteral)) {
      fields.add(fieldName);
    }
  }
  return fields;
};

export const typeFields = (file: SourceFile | null, typeName: string): Set<string> => {
  if (!file) {
    return new Set<string>();
  }
  const fields = new Set<string>();
  file.getInterface(typeName)?.getProperties().forEach((property) => fields.add(property.getName()));
  file.getTypeAlias(typeName)?.getDescendantsOfKind(SyntaxKind.PropertySignature).forEach((property) => fields.add(property.getName()));
  return fields;
};

export const hasFields = (fields: Set<string>, expected: readonly string[]): string[] =>
  expected.filter((field) => !fields.has(field));

export const hasPropertyCall = (file: SourceFile | null, receiver: string, propertyName: string): boolean =>
  Boolean(file?.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getExpression().getText() === receiver
      && expression.getName() === propertyName;
  }));

export const classMethods = (file: SourceFile | null, className: string): Set<string> =>
  new Set((file?.getClass(className)?.getMethods() ?? []).map((method) => method.getName()));

export const interfaceMethods = (file: SourceFile | null, interfaceName: string): Set<string> =>
  new Set((file?.getInterface(interfaceName)?.getMethods() ?? []).map((method) => method.getName()));
