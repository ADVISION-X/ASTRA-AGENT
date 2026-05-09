import { Node, Project } from "ts-morph";

import { pathFromRepoRoot } from "../../core/paths.js";

export function source(project: Project, path: string) {
  return project.addSourceFileAtPathIfExists(pathFromRepoRoot(path));
}

export function unwrapExpression(expression: Node | undefined): Node | undefined {
  if (!expression) {
    return undefined;
  }
  if (Node.isAsExpression(expression) || Node.isSatisfiesExpression(expression)) {
    return unwrapExpression(expression.getExpression());
  }
  if (Node.isCallExpression(expression)) {
    return expression.getArguments().find(Node.isObjectLiteralExpression) ?? expression.getArguments().find(Node.isArrayLiteralExpression) ?? expression;
  }
  return expression;
}

export function literalArray(sourceFile: NonNullable<ReturnType<typeof source>>, name: string): string[] {
  const declaration = sourceFile.getVariableDeclaration(name);
  const initializer = unwrapExpression(declaration?.getInitializer());
  if (!initializer || !Node.isArrayLiteralExpression(initializer)) {
    return [];
  }
  return initializer.getElements().flatMap((element) => Node.isStringLiteral(element) ? [element.getLiteralText()] : []);
}

function getNamedPropertyValue(objectLiteral: Node | undefined, property: string): Node | undefined {
  if (!objectLiteral || !Node.isObjectLiteralExpression(objectLiteral)) {
    return undefined;
  }

  const matchedProperty = objectLiteral.getProperties().find((item) => {
    if (!Node.isPropertyAssignment(item)) {
      return false;
    }
    const name = item.getNameNode();
    return Node.isStringLiteral(name) ? name.getLiteralText() === property : name.getText() === property;
  });

  return Node.isPropertyAssignment(matchedProperty) ? matchedProperty.getInitializer() : undefined;
}

export function objectPropertyArray(sourceFile: NonNullable<ReturnType<typeof source>>, channel: string, property: string): string[] {
  const registry = unwrapExpression(sourceFile.getVariableDeclaration("NERVE_BUS_CHANNEL_REGISTRY")?.getInitializer());
  const channelObject = unwrapExpression(getNamedPropertyValue(registry, channel));
  const array = unwrapExpression(getNamedPropertyValue(channelObject, property));
  if (!array || !Node.isArrayLiteralExpression(array)) {
    return [];
  }
  return array.getElements().flatMap((element) => Node.isStringLiteral(element) ? [element.getLiteralText()] : []);
}
