import {
  Node,
  SyntaxKind,
  type AsExpression,
  type AwaitExpression,
  type CallExpression,
  type ImportSpecifier,
  type NonNullExpression,
  type Node as MorphNode,
  type ParenthesizedExpression,
  type TypeAssertion,
} from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";

const fsModuleSpecifiers = new Set(["fs", "fs/promises", "node:fs", "node:fs/promises"]);
const provenReadOnlyFsApis = new Set([
  "access", "accessSync", "createReadStream", "existsSync", "fstat", "fstatSync",
  "lstat", "lstatSync", "opendir", "opendirSync", "read", "readSync", "readdir",
  "readdirSync", "readFile", "readFileSync", "readlink", "readlinkSync", "realpath",
  "realpathSync", "stat", "statSync", "statfs", "statfsSync",
]);

const declarationKey = (declaration: MorphNode): string =>
  `${declaration.getSourceFile().getFilePath()}:${declaration.getStart()}`;

const resolvedString = (node: MorphNode | undefined, seen = new Set<string>()): string | undefined => {
  if (!node) return undefined;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) return node.getLiteralText();
  if (!Node.isIdentifier(node)) return undefined;
  for (const declaration of node.getSymbol()?.getDeclarations() ?? []) {
    if (!Node.isVariableDeclaration(declaration)) continue;
    const key = declarationKey(declaration);
    if (seen.has(key)) continue;
    const value = resolvedString(declaration.getInitializer(), new Set(seen).add(key));
    if (value !== undefined) return value;
  }
  return undefined;
};

const isTransparentExpression = (node: MorphNode): node is
  ParenthesizedExpression | AsExpression | TypeAssertion | NonNullExpression | AwaitExpression =>
  Node.isParenthesizedExpression(node) || Node.isAsExpression(node)
  || Node.isTypeAssertion(node) || Node.isNonNullExpression(node) || Node.isAwaitExpression(node);

const fsImportDeclaration = (node: MorphNode) => node.getFirstAncestorByKind(SyntaxKind.ImportDeclaration);

const isFsImportSpecifier = (declaration: MorphNode): declaration is ImportSpecifier =>
  Node.isImportSpecifier(declaration)
  && fsModuleSpecifiers.has(declaration.getImportDeclaration().getModuleSpecifierValue());

const isFsDynamicImport = (node: MorphNode): boolean => {
  if (!Node.isCallExpression(node) || node.getExpression().getKind() !== SyntaxKind.ImportKeyword) return false;
  const argument = node.getArguments()[0];
  return Boolean(argument && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))
    && fsModuleSpecifiers.has(argument.getLiteralValue()));
};

const bindingElementFsMethod = (declaration: MorphNode): { methodName: string | undefined; source: MorphNode } | null => {
  if (!Node.isBindingElement(declaration)) return null;
  const variable = declaration.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  const source = variable?.getInitializer();
  if (!source) return null;
  const property = declaration.getPropertyNameNode() ?? declaration.getNameNode();
  return { methodName: resolvedString(property), source };
};

const expressionIsFsNamespace = (node: MorphNode | undefined, seen = new Set<string>()): boolean => {
  if (!node) return false;
  if (isTransparentExpression(node)) return expressionIsFsNamespace(node.getExpression(), seen);
  if (isFsDynamicImport(node)) return true;
  if (Node.isPropertyAccessExpression(node) && node.getName() === "promises") {
    return expressionIsFsNamespace(node.getExpression(), seen);
  }
  if (!Node.isIdentifier(node)) return false;
  for (const declaration of node.getSymbol()?.getDeclarations() ?? []) {
    if (Node.isNamespaceImport(declaration) || Node.isImportClause(declaration)) {
      const imported = fsImportDeclaration(declaration);
      if (imported && fsModuleSpecifiers.has(imported.getModuleSpecifierValue())) return true;
      continue;
    }
    if (!Node.isVariableDeclaration(declaration)) continue;
    const key = declarationKey(declaration);
    if (seen.has(key)) continue;
    if (expressionIsFsNamespace(declaration.getInitializer(), new Set(seen).add(key))) return true;
  }
  return false;
};

const identifierIsFsMutation = (node: MorphNode, seen: Set<string>): boolean => {
  if (!Node.isIdentifier(node)) return false;
  for (const declaration of node.getSymbol()?.getDeclarations() ?? []) {
    if (isFsImportSpecifier(declaration)) return !provenReadOnlyFsApis.has(declaration.getName());
    if (Node.isImportSpecifier(declaration)) continue;
    const binding = bindingElementFsMethod(declaration);
    if (binding && expressionIsFsNamespace(binding.source)) {
      return binding.methodName === undefined || !provenReadOnlyFsApis.has(binding.methodName);
    }
    if (!Node.isVariableDeclaration(declaration)) continue;
    const key = declarationKey(declaration);
    if (seen.has(key)) continue;
    if (expressionIsFsMutation(declaration.getInitializer(), new Set(seen).add(key))) return true;
  }
  return false;
};

const expressionIsFsMutation = (node: MorphNode | undefined, seen = new Set<string>()): boolean => {
  if (!node) return false;
  if (isTransparentExpression(node)) return expressionIsFsMutation(node.getExpression(), seen);
  if (Node.isPropertyAccessExpression(node) || Node.isElementAccessExpression(node)) {
    const receiver = node.getExpression();
    const methodName = Node.isPropertyAccessExpression(node) ? node.getName() : resolvedString(node.getArgumentExpression());
    if (expressionIsFsNamespace(receiver)) return methodName === undefined || !provenReadOnlyFsApis.has(methodName);
    if (methodName === "apply" || methodName === "bind" || methodName === "call") {
      return expressionIsFsMutation(receiver, seen);
    }
  }
  return identifierIsFsMutation(node, seen);
};

const functionNodeFor = (declaration: MorphNode): MorphNode | undefined => {
  if (Node.isFunctionLikeDeclaration(declaration)) return declaration;
  if (!Node.isVariableDeclaration(declaration)) return undefined;
  const initializer = declaration.getInitializer();
  return initializer && Node.isFunctionLikeDeclaration(initializer) ? initializer : undefined;
};

const callReachesFsMutation = (
  call: CallExpression,
  inspectedFiles: Set<string>,
  seenFunctions = new Set<string>(),
): boolean => {
  if (expressionIsFsMutation(call.getExpression()) || call.getArguments().some((argument) => expressionIsFsMutation(argument))) return true;
  const symbol = call.getExpression().getSymbol();
  const resolved = symbol?.getAliasedSymbol() ?? symbol;
  for (const declaration of resolved?.getDeclarations() ?? []) {
    const functionNode = functionNodeFor(declaration);
    if (!functionNode || functionNode.getSourceFile().isDeclarationFile()) continue;
    const key = declarationKey(functionNode);
    if (seenFunctions.has(key)) continue;
    const nextSeen = new Set(seenFunctions).add(key);
    inspectedFiles.add(functionNode.getSourceFile().getFilePath());
    if (functionNode.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((candidate) => candidate.getFirstAncestor(Node.isFunctionLikeDeclaration) === functionNode)
      .some((candidate) => callReachesFsMutation(candidate, inspectedFiles, nextSeen))) return true;
  }
  return false;
};

export const inspectOwnerFilesystemWriters = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const sourceFile of context.project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    if (!filePath.includes("/scripts/audit/domains/")) continue;
    inspectedFiles.add(filePath);
    const callsMutation = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
      .some((call) => callReachesFsMutation(call, inspectedFiles));
    if (!callsMutation) continue;
    findings.push(createFinding({
      checkId: "audit-system/runner-law-truth",
      lawId,
      filePath,
      message: "Owner inspector source must be read-only and return its report payload to the unique generated-plan writer.",
    }));
  }
};
