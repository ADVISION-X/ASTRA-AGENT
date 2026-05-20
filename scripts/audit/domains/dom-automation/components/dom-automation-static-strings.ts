import { Node, SyntaxKind, type SourceFile } from "ts-morph";

const resolveTemplateString = (expression: import("ts-morph").TemplateExpression): string | null => {
  let resolved = expression.getHead().getLiteralText();
  for (const span of expression.getTemplateSpans()) {
    const segment = resolveStaticString(span.getExpression());
    if (segment == null) return null;
    resolved += segment;
    resolved += span.getLiteral().getLiteralText();
  }
  return resolved;
};

const resolveBinaryString = (expression: import("ts-morph").BinaryExpression): string | null => {
  if (expression.getOperatorToken().getKind() !== SyntaxKind.PlusToken) return null;
  const left = resolveStaticString(expression.getLeft());
  const right = resolveStaticString(expression.getRight());
  return left != null && right != null ? `${left}${right}` : null;
};

const resolveLiteralString = (expression: Node): string | null =>
  Node.isStringLiteral(expression) || Node.isNoSubstitutionTemplateLiteral(expression)
    ? expression.getLiteralText()
    : null;

const resolveKnownStaticString = (expression: Node): string | null =>
  resolveLiteralString(expression)
  ?? (Node.isTemplateExpression(expression) ? resolveTemplateString(expression) : null)
  ?? (Node.isBinaryExpression(expression) ? resolveBinaryString(expression) : null)
  ?? (Node.isParenthesizedExpression(expression) ? resolveStaticString(expression.getExpression()) : null);

export const resolveStaticString = (expression: Node | undefined): string | null =>
  expression ? resolveKnownStaticString(expression) : null;

export const collectStringLiteralNodes = (sourceFile: SourceFile): Array<{ text: string; line: number }> => {
  const literals: Array<{ text: string; line: number }> = [];
  sourceFile.forEachDescendant((node) => {
    if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
      literals.push({ text: node.getLiteralText(), line: node.getStartLineNumber() });
      return;
    }
    const resolved = Node.isTemplateExpression(node) || Node.isBinaryExpression(node)
      ? resolveStaticString(node)
      : null;
    if (resolved != null) literals.push({ text: resolved, line: node.getStartLineNumber() });
  });
  return literals;
};

export const hasIdentifierCall = (sourceFile: SourceFile, identifierName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === identifierName;
  });

export const objectLiteralPropertyNames = (expression: Node | undefined): string[] => {
  if (!expression || !Node.isObjectLiteralExpression(expression)) return [];
  return expression.getProperties().flatMap((property) => {
    if (!Node.isPropertyAssignment(property) && !Node.isShorthandPropertyAssignment(property)) return [];
    const nameNode = property.getNameNode();
    if (!Node.isComputedPropertyName(nameNode)) return [nameNode.getText().replace(/^['"]|['"]$/g, "")];
    const computed = resolveStaticString(nameNode.getExpression());
    return computed ? [computed] : [];
  });
};
