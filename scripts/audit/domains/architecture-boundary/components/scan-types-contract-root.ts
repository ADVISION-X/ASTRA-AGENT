import { Node, SyntaxKind, type Expression, type Node as MorphNode, type Project, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../../shared/source-files.js";
import { toRepoPath } from "../../../shared/paths.js";

const callRoot = (expression: Expression): Node => {
  if (Node.isPropertyAccessExpression(expression)) return callRoot(expression.getExpression());
  if (Node.isCallExpression(expression)) return callRoot(expression.getExpression());
  return expression;
};

const declarationIsDeclarativeSchema = (
  declaration: MorphNode,
  seen: Set<string>,
): boolean => {
  const key = `${toRepoPath(declaration.getSourceFile().getFilePath())}:${declaration.getStart()}`;
  if (seen.has(key)) return false;
  seen.add(key);
  const importDeclaration = declaration.getFirstAncestorByKind(SyntaxKind.ImportDeclaration);
  if (importDeclaration?.getModuleSpecifierValue() === "zod") return true;
  if (!Node.isVariableDeclaration(declaration)) return false;
  const initializer = declaration.getInitializer();
  if (!initializer) return false;
  const expression = Node.isCallExpression(initializer) ? initializer.getExpression() : initializer;
  return schemaExpressionIsDeclarative(expression, seen);
};

const schemaExpressionIsDeclarative = (expression: Expression, seen: Set<string>): boolean => {
  const root = callRoot(expression);
  const symbol = root.getSymbol();
  const target = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
  const declarations = [
    ...(symbol?.getDeclarations() ?? []),
    ...(target?.getDeclarations() ?? []),
  ];
  return declarations.some((declaration) => declarationIsDeclarativeSchema(declaration, seen));
};

const schemaCallIsDeclarative = (expression: Expression): boolean =>
  schemaExpressionIsDeclarative(expression, new Set());

const forbiddenRuntimeImport = (sourceFile: SourceFile): Node | undefined => {
  return sourceFile.getImportDeclarations().find((declaration) => {
    if (declaration.isTypeOnly() || declaration.getModuleSpecifierValue() === "zod") return false;
    const hasBindings = declaration.getDefaultImport() !== undefined
      || declaration.getNamespaceImport() !== undefined
      || declaration.getNamedImports().length > 0;
    if (!hasBindings) return true;
    const target = declaration.getModuleSpecifierSourceFile();
    return target === undefined || !toRepoPath(target.getFilePath()).startsWith("src/types/");
  });
};

const forbiddenStatementKinds = new Set([
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.ClassDeclaration,
  SyntaxKind.EnumDeclaration,
  SyntaxKind.ExpressionStatement,
  SyntaxKind.IfStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.TryStatement,
  SyntaxKind.SwitchStatement,
  SyntaxKind.ThrowStatement,
]);
const nodeIsFunctionValue = (node: Node): boolean =>
  Node.isArrowFunction(node) || Node.isFunctionExpression(node) || Node.isClassExpression(node);
const nodeIsRuntimeEffect = (node: Node): boolean => {
  if (Node.isAwaitExpression(node) || Node.isNewExpression(node) || Node.isPostfixUnaryExpression(node)) return true;
  if (Node.isPrefixUnaryExpression(node)) {
    return [SyntaxKind.PlusPlusToken, SyntaxKind.MinusMinusToken].includes(node.getOperatorToken());
  }
  if (!Node.isBinaryExpression(node)) return false;
  const operator = node.getOperatorToken().getKind();
  return operator >= SyntaxKind.FirstAssignment && operator <= SyntaxKind.LastAssignment;
};

const forbiddenRuntimeNode = (sourceFile: SourceFile): Node | undefined => {
  const runtimeImport = forbiddenRuntimeImport(sourceFile);
  if (runtimeImport) return runtimeImport;
  const forbiddenStatement = sourceFile.getStatements()
    .find((statement) => forbiddenStatementKinds.has(statement.getKind()));
  if (forbiddenStatement) return forbiddenStatement;
  const functionValue = sourceFile.getDescendants().find(nodeIsFunctionValue);
  if (functionValue) return functionValue;
  const effectNode = sourceFile.getDescendants().find(nodeIsRuntimeEffect);
  if (effectNode) return effectNode;
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => !schemaCallIsDeclarative(call.getExpression()));
};

export const inspectTypesContractRoot = (input: {
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
  project: Project;
}): void => {
  for (const sourceFile of listActiveSourceFiles(input.project)) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!repoPath.startsWith("src/types/")) continue;
    input.inspectedFiles.add(repoPath);
    const forbidden = forbiddenRuntimeNode(sourceFile);
    if (!forbidden) continue;
    input.findings.push(createFinding({ evidenceMode: "static.ast",
      checkId: "architecture/types-contract-runtime-logic",
      lawId: input.lawId,
      filePath: repoPath,
      message: `${repoPath} contains executable runtime logic; src/types permits only declarative shared type and schema contracts.`,
      evidence: forbidden.getText(),
    }));
  }
};

export const inspectTypesContractRelations = (input: {
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
  project: Project;
}): void => {
  for (const sourceFile of listActiveSourceFiles(input.project)) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!repoPath.startsWith("src/types/")) continue;
    input.inspectedFiles.add(repoPath);
    for (const symbol of sourceFile.getExportSymbols()) {
      const target = symbol.isAlias() ? symbol.getAliasedSymbol() : symbol;
      const declaration = target?.getDeclarations()[0];
      const type = declaration?.getType().getText(declaration) ?? "missing";
      if (type !== "missing" && type !== "any") continue;
      input.findings.push(createFinding({ evidenceMode: "static.types",
        checkId: "architecture/types-contract-unresolved-type", lawId: input.lawId,
        filePath: repoPath, message: `${repoPath} export ${symbol.getName()} resolves to ${type}.`,
        evidence: `TypeChecker relation ${symbol.getName()}:${type}`,
      }));
    }
  }
};
