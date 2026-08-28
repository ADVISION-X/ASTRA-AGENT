import { Node, SyntaxKind, type CallExpression, type CatchClause, type Node as MorphNode } from "ts-morph";

import type { GovernedFile } from "./code-purity-governed-files.js";
import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";

const prohibitedPath = /(?:mock|demo|placeholder|no[-_]?op|fallback)/iu;
const successWords = new Set(["ok", "pass", "passed", "ready", "success", "successful"]);

const pushRuntimeEscape = (
  collector: InventoryFindingCollector, governedFile: GovernedFile, lawId: string,
  checkId: string, reason: string, line: number,
): void => collector.push({
  checkId, evidenceMode: "static.ast", filePath: governedFile.repoPath, lawId,
  owner: governedFile.owner, reason, remediation: "Delete the fake path and make failure explicit in the sole production route.",
  role: governedFile.role, verificationCommand: "npm run quality:check -- READY",
}, `${governedFile.repoPath} ${reason} near line ${line}.`);

const literalSignalsSuccess = (node: MorphNode | undefined): boolean => {
  if (!node) return false;
  if (Node.isTrueLiteral(node)) return true;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return successWords.has(node.getLiteralText().toLowerCase());
  }
  if (!Node.isObjectLiteralExpression(node)) return false;
  return node.getProperties().some((property) => Node.isPropertyAssignment(property)
    && ["ok", "passed", "ready", "success"].includes(property.getName().toLowerCase())
    && literalSignalsSuccess(property.getInitializer()));
};

const callbackSignalsSuccess = (callback: MorphNode): boolean => {
  if (!Node.isArrowFunction(callback) && !Node.isFunctionExpression(callback)) return false;
  const body = callback.getBody();
  if (!Node.isBlock(body)) return literalSignalsSuccess(body);
  return body.getStatements().some((statement) => Node.isReturnStatement(statement)
    && literalSignalsSuccess(statement.getExpression()));
};

const scanCatchClause = (
  clause: CatchClause, collector: InventoryFindingCollector, governedFile: GovernedFile, lawId: string,
): void => {
  const statements = clause.getBlock().getStatements();
  if (!statements.length) pushRuntimeEscape(collector, governedFile, lawId,
    "code-purity/catch-and-swallow", "contains an empty catch-and-swallow branch", clause.getStartLineNumber());
  const fakeSuccess = clause.getBlock().getStatements()
    .find((statement) => Node.isReturnStatement(statement) && literalSignalsSuccess(statement.getExpression()));
  if (fakeSuccess) pushRuntimeEscape(collector, governedFile, lawId,
    "code-purity/catch-fake-success", "returns a fake success value from a catch branch", fakeSuccess.getStartLineNumber());
};

const catchCallback = (call: CallExpression): MorphNode | undefined => {
  const expression = call.getExpression();
  if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "catch") return undefined;
  return call.getArguments()[0];
};

const callbackSwallows = (callback: MorphNode): boolean => {
  if (!Node.isArrowFunction(callback) && !Node.isFunctionExpression(callback)) return false;
  const body = callback.getBody();
  if (!Node.isBlock(body)) return body.getText() === "undefined" || Node.isVoidExpression(body);
  return body.getStatements().length === 0;
};

const scanPromiseCatch = (
  call: CallExpression, collector: InventoryFindingCollector, governedFile: GovernedFile, lawId: string,
): void => {
  const callback = catchCallback(call);
  if (!callback) return;
  if (callbackSwallows(callback)) pushRuntimeEscape(collector, governedFile, lawId,
    "code-purity/promise-catch-and-swallow", "contains a Promise catch-and-swallow branch", call.getStartLineNumber());
  if (callbackSignalsSuccess(callback)) pushRuntimeEscape(collector, governedFile, lawId,
    "code-purity/promise-catch-fake-success", "returns a fake success value from a Promise catch branch",
    call.getStartLineNumber());
};

const declarationName = (node: MorphNode): string | null => {
  if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node) || Node.isVariableDeclaration(node)) {
    return node.getName() ?? null;
  }
  return null;
};

const isCallableDeclaration = (node: MorphNode): boolean => Node.isFunctionDeclaration(node)
  || Node.isMethodDeclaration(node)
  || (Node.isVariableDeclaration(node) && Boolean(node.getInitializer()
    && (Node.isArrowFunction(node.getInitializer()!) || Node.isFunctionExpression(node.getInitializer()!))));

export const scanStructuralRuntimeEscapes = (
  governedFile: GovernedFile, collector: InventoryFindingCollector, lawId: string,
): void => {
  for (const clause of governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.CatchClause)) {
    scanCatchClause(clause, collector, governedFile, lawId);
  }
  for (const call of governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    scanPromiseCatch(call, collector, governedFile, lawId);
  }
  for (const node of governedFile.sourceFile.getDescendants()) {
    const name = declarationName(node);
    if (name && isCallableDeclaration(node) && prohibitedPath.test(name)) pushRuntimeEscape(
      collector, governedFile, lawId, "code-purity/prohibited-production-path",
      `declares prohibited production path ${name}`, node.getStartLineNumber());
  }
};
