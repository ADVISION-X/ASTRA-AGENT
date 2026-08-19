import { existsSync, readFileSync } from "node:fs";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astExpressionPath, astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

export type BrowserLawBinding = Readonly<{ lawId: string; clauseId: string }>;
export type ExternalNonTypeScriptSource = Readonly<{
  filePath: string;
  value: string;
}>;

export const addBrowserFinding = (
  findings: InspectorFinding[],
  checkId: string,
  law: BrowserLawBinding,
  filePath: string,
  message: string,
): void => {
  findings.push(createFinding({
    checkId,
    lawId: law.lawId,
    clauseId: law.clauseId,
    filePath,
    message,
  }));
};

export const requireAstSource = (
  context: InspectorContext,
  findings: InspectorFinding[],
  checkId: string,
  law: BrowserLawBinding,
  filePath: string,
): SourceFile | undefined => {
  const source = context.project.getSourceFile(resolveFromRepo(filePath));
  if (!source) {
    addBrowserFinding(
      findings,
      checkId,
      law,
      filePath,
      "required Browser Authority source is missing from the audit project",
    );
  }
  return source;
};

export const requireExternalText = (
  findings: InspectorFinding[],
  checkId: string,
  law: BrowserLawBinding,
  filePath: string,
): ExternalNonTypeScriptSource => {
  const absolute = resolveFromRepo(filePath);
  if (!existsSync(absolute)) {
    addBrowserFinding(
      findings,
      checkId,
      law,
      filePath,
      "required non-TypeScript Browser Authority source is missing",
    );
    return { filePath, value: "" };
  }
  return { filePath, value: readFileSync(absolute, "utf8") };
};

export const sourceHasIdentifier = (source: SourceFile, expected: string): boolean =>
  source.getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => astIdentifierName(identifier) === expected);

export const sourceHasString = (source: SourceFile, expected: string): boolean => [
  ...source.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .map((literal) => literal.getLiteralValue()),
  ...source.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)
    .map((literal) => literal.getLiteralValue()),
  ...source.getDescendantsOfKind(SyntaxKind.TemplateHead)
    .map((literal) => literal.getLiteralText()),
  ...source.getDescendantsOfKind(SyntaxKind.TemplateMiddle)
    .map((literal) => literal.getLiteralText()),
  ...source.getDescendantsOfKind(SyntaxKind.TemplateTail)
    .map((literal) => literal.getLiteralText()),
  ...source.getDescendantsOfKind(SyntaxKind.RegularExpressionLiteral)
    .map((literal) => literal.compilerNode.text),
].some((literal) => literal.includes(expected));

const sourceHasNumericValue = (source: SourceFile, expected: number): boolean =>
  source.getDescendantsOfKind(SyntaxKind.NumericLiteral)
    .some((literal) => literal.getLiteralValue() === expected);

export const requireAstFacts = (input: {
  source: SourceFile;
  findings: InspectorFinding[];
  checkId: string;
  law: BrowserLawBinding;
  filePath: string;
  identifiers?: readonly string[];
  strings?: readonly string[];
  numbers?: readonly number[];
}): void => {
  for (const identifier of input.identifiers ?? []) {
    if (!sourceHasIdentifier(input.source, identifier)) {
      addBrowserFinding(
        input.findings,
        input.checkId,
        input.law,
        input.filePath,
        `required production identifier is missing: ${identifier}`,
      );
    }
  }
  for (const value of input.strings ?? []) {
    if (!sourceHasString(input.source, value)) {
      addBrowserFinding(
        input.findings,
        input.checkId,
        input.law,
        input.filePath,
        `required production literal is missing: ${value}`,
      );
    }
  }
  for (const value of input.numbers ?? []) {
    if (!sourceHasNumericValue(input.source, value)) {
      addBrowserFinding(
        input.findings,
        input.checkId,
        input.law,
        input.filePath,
        `required production numeric invariant is missing: ${value}`,
      );
    }
  }
};

export const forbidAstFacts = (input: {
  source: SourceFile;
  findings: InspectorFinding[];
  checkId: string;
  law: BrowserLawBinding;
  filePath: string;
  identifiers?: readonly string[];
  strings?: readonly string[];
}): void => {
  for (const identifier of input.identifiers ?? []) {
    if (sourceHasIdentifier(input.source, identifier)) {
      addBrowserFinding(
        input.findings,
        input.checkId,
        input.law,
        input.filePath,
        `forbidden production identifier is present: ${identifier}`,
      );
    }
  }
  for (const value of input.strings ?? []) {
    if (sourceHasString(input.source, value)) {
      addBrowserFinding(
        input.findings,
        input.checkId,
        input.law,
        input.filePath,
        `forbidden production literal is present: ${value}`,
      );
    }
  }
};

const callName = (node: Node): string | undefined => {
  if (!Node.isCallExpression(node)) return undefined;
  const expression = node.getExpression();
  if (Node.isIdentifier(expression)) return astIdentifierName(expression);
  if (Node.isPropertyAccessExpression(expression)) return expression.getName();
  return undefined;
};

const callsWithin = (node: Node): Node[] => node.getDescendantsOfKind(SyntaxKind.CallExpression);

export const assertCallOrder = (input: {
  source: SourceFile;
  findings: InspectorFinding[];
  checkId: string;
  law: BrowserLawBinding;
  filePath: string;
  first: string;
  second: string;
  scopeName?: string;
  message: string;
}): void => {
  const scope = input.scopeName
    ? input.source.getFunctions().find((declaration) => declaration.getName() === input.scopeName)
      ?? input.source.getDescendantsOfKind(SyntaxKind.MethodDeclaration)
        .find((declaration) => declaration.getName() === input.scopeName)
    : input.source;
  const calls = scope ? callsWithin(scope) : [];
  const first = calls.find((call) => callName(call) === input.first)?.getStart();
  const second = calls.find((call) => callName(call) === input.second)?.getStart();
  if (first === undefined || second === undefined || first >= second) {
    addBrowserFinding(
      input.findings,
      input.checkId,
      input.law,
      input.filePath,
      input.message,
    );
  }
};

export const assertStringBeforeAssignment = (input: {
  source: SourceFile;
  findings: InspectorFinding[];
  checkId: string;
  law: BrowserLawBinding;
  filePath: string;
  stringValue: string;
  assignmentPath: string;
  scopeName: string;
  message: string;
}): void => {
  const scope = input.source.getDescendantsOfKind(SyntaxKind.MethodDeclaration)
    .find((method) => method.getName() === input.scopeName);
  const literal = scope?.getDescendants().find((node) =>
    (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))
    && node.getLiteralValue().includes(input.stringValue));
  const assignment = scope?.getDescendantsOfKind(SyntaxKind.BinaryExpression)
    .find((expression) => expression.getOperatorToken().getKind() === SyntaxKind.EqualsToken
      && astExpressionPath(expression.getLeft()) === input.assignmentPath);
  if (!literal || !assignment || literal.getStart() >= assignment.getStart()) {
    addBrowserFinding(
      input.findings,
      input.checkId,
      input.law,
      input.filePath,
      input.message,
    );
  }
};

export const hasPrivateConstructor = (source: SourceFile): boolean =>
  source.getDescendantsOfKind(SyntaxKind.Constructor).some((constructor) =>
    constructor.hasModifier(SyntaxKind.PrivateKeyword));

export const externalTextHasAll = (
  source: ExternalNonTypeScriptSource,
  required: readonly string[],
): boolean => required.every((token) => source.value.indexOf(token) >= 0);
