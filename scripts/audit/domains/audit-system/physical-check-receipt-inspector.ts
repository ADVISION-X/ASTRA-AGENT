import { existsSync, readFileSync } from "node:fs";

import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type CallExpression,
  type Node as MorphNode,
  type SourceFile,
} from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { inspectAcceptanceDeliveryIsolation } from "./acceptance-delivery-isolation-inspector.js";
import { inspectCiControlIntegrity } from "./ci-control-integrity-inspector.js";
import { isDefinitelyUnreachable } from "./control-flow-reachability.js";
import { inspectOwnerRegistrations } from "./owner-registration-inspector.js";

const runnerPath = "scripts/audit/core/run-generated-plan.ts";
const sessionPath = "scripts/audit/shared/inspector-check-session.ts";
const contractsPath = "scripts/audit/shared/inspector-contracts.ts";
const packagePath = "package.json";
const ciFullPath = "scripts/audit/ci-full.ts";
const failFastPath = "scripts/audit/ci-fail-fast.ts";

const inspectLegacyReceiptEscape = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  inspectedFiles.add(contractsPath);
  for (const sourceFile of context.project.getSourceFiles()) {
    const declaration = sourceFile.getVariableDeclaration("executedChecksForPlan")
      ?? sourceFile.getFunction("executedChecksForPlan");
    if (!declaration) continue;
    findings.push(createFinding({
      checkId: "audit-system/runner-law-truth",
      lawId,
      filePath: sourceFile.getFilePath(),
      message: "Legacy plan-derived executedChecks helper must not exist.",
    }));
  }
};

export const inspectLegacyReceiptContract = (
  context: InspectorContext,
  lawId: string,
): { findings: InspectorFinding[]; inspectedFiles: string[] } => {
  const findings: InspectorFinding[] = [];
  const inspectedFiles = new Set<string>();
  inspectLegacyReceiptEscape(context, findings, inspectedFiles, lawId);
  return { findings, inspectedFiles: [...inspectedFiles].sort() };
};

const realChromeConditionIsExact = (condition: MorphNode, parameter: MorphNode): boolean => {
  if (!Node.isBinaryExpression(condition)) return false;
  const left = condition.getLeft();
  const right = condition.getRight();
  return condition.getOperatorToken().getKind() === SyntaxKind.ExclamationEqualsEqualsToken
    && Node.isPropertyAccessExpression(left) && left.getName() === "evidenceMode"
    && resolvesTo(left.getExpression(), parameter)
    && Node.isStringLiteral(right) && right.getLiteralText() === "real-chrome";
};

const realChromeFilterIsExact = (call: CallExpression): boolean => {
  const callee = call.getExpression();
  if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== "filter") return false;
  const bindings = callee.getExpression();
  const entry = Node.isPropertyAccessExpression(bindings) && bindings.getName() === "bindings"
    ? bindings.getExpression() : undefined;
  const callback = call.getArguments()[0];
  if (!Node.isIdentifier(entry)
    || (!Node.isArrowFunction(callback) && !Node.isFunctionExpression(callback))) return false;
  const entryIsParameter = entry.getSymbol()?.getDeclarations().some(Node.isParameterDeclaration) ?? false;
  const parameter = callback.getParameters()[0];
  const rawCondition = callback.getBody();
  const condition = Node.isParenthesizedExpression(rawCondition) ? rawCondition.getExpression() : rawCondition;
  return entryIsParameter && parameter !== undefined && realChromeConditionIsExact(condition, parameter);
};

const valueChainExcludesRealChrome = (expression: MorphNode | undefined): boolean => {
  if (!expression) return false;
  if (Node.isParenthesizedExpression(expression) || Node.isAsExpression(expression)
    || Node.isTypeAssertion(expression) || Node.isNonNullExpression(expression)) {
    return valueChainExcludesRealChrome(expression.getExpression());
  }
  if (!Node.isCallExpression(expression)) return false;
  const callee = expression.getExpression();
  if (!Node.isPropertyAccessExpression(callee)) return false;
  if (callee.getName() === "filter") return realChromeFilterIsExact(expression);
  if (["flatMap", "map"].includes(callee.getName())) return valueChainExcludesRealChrome(callee.getExpression());
  const receiver = callee.getExpression();
  const objectFreeze = callee.getName() === "freeze" && Node.isIdentifier(receiver)
    && receiver.getSymbol()?.getEscapedName().toString() === "Object"
    && (receiver.getSymbol()?.getDeclarations().every((item) => item.getSourceFile().isDeclarationFile()) ?? false);
  return objectFreeze && valueChainExcludesRealChrome(expression.getArguments()[0]);
};

const sourceMappingExcludesRealChrome = (source: SourceFile | undefined, name: string): boolean => {
  const initializer = source?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === name)?.getInitializer();
  return valueChainExcludesRealChrome(initializer);
};

const inspectRunnerSession = (
  context: InspectorContext, findings: InspectorFinding[], inspectedFiles: Set<string>, lawId: string,
): void => {
  inspectedFiles.add(runnerPath); inspectedFiles.add(sessionPath);
  const runner = context.project.getSourceFile(resolveFromRepo(runnerPath));
  const session = context.project.getSourceFile(resolveFromRepo(sessionPath));
  const sessionFactory = runner?.getImportDeclarations().find((item) => item.getModuleSpecifierSourceFile() === session)
    ?.getNamedImports().find((item) => item.getName() === "createInspectorCheckSession");
  const controls = [["createInspectorCheckSession", sessionFactory],
    ["validateSessionInspectorOutput", runner?.getVariableDeclaration("validateSessionInspectorOutput")]] as const;
  for (const [name, declaration] of controls) {
    const called = declaration && runner?.getDescendantsOfKind(SyntaxKind.CallExpression)
      .some((call) => resolvesTo(call.getExpression(), declaration));
    if (!called) findings.push(createFinding({ checkId: "audit-system/runner-law-truth", lawId,
      filePath: runnerPath, message: `Unique generated-plan runner is missing current-run receipt control ${name}.` }));
  }
  if (sourceMappingExcludesRealChrome(session, "executedChecks")
    && sourceMappingExcludesRealChrome(runner, "expectedChecks")) return;
  findings.push(createFinding({ checkId: "audit-system/runner-law-truth", lawId, filePath: sessionPath,
    message: "Ordinary owner executedChecks and runner expectations must structurally exclude real-chrome bindings." }));
};

export const inspectRunnerSessionContract = (
  context: InspectorContext,
  lawId: string,
): { findings: InspectorFinding[]; inspectedFiles: string[] } => {
  const findings: InspectorFinding[] = [];
  const inspectedFiles = new Set<string>();
  inspectRunnerSession(context, findings, inspectedFiles, lawId);
  return { findings, inspectedFiles: [...inspectedFiles].sort() };
};

const inspectAuditScriptEntrypoints = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  inspectedFiles.add(packagePath);
  const parsed = JSON.parse(readFileSync(resolveFromRepo(packagePath), "utf8")) as { scripts?: Record<string, string> };
  for (const [name, command] of Object.entries(parsed.scripts ?? {})) {
    if (!name.startsWith("audit:")) continue;
    if (!command.includes("scripts/audit/domains/") && !command.includes("run-inspector.ts")) continue;
    findings.push(createFinding({
      checkId: "audit-system/runner-order-truth",
      lawId,
      filePath: packagePath,
      message: `${name} bypasses the unique generated-plan runner.`,
      evidence: command,
    }));
  }
  for (const stalePath of [
    "scripts/audit/domains/runtime-log-spine/run-inspector.ts",
    "scripts/audit/domains/facebook-product-video-mining-log-coverage/run-inspector.ts",
    "scripts/audit/domains/media-processing-capability/run-inspector.ts",
  ]) {
    inspectedFiles.add(stalePath);
    if (!existsSync(resolveFromRepo(stalePath))) continue;
    findings.push(createFinding({
      checkId: "audit-system/runner-order-truth",
      lawId,
      filePath: stalePath,
      message: "Private owner runner must be deleted after current-run receipt migration.",
    }));
  }
};

const resolvesTo = (node: MorphNode | undefined, declaration: MorphNode): boolean => {
  const symbol = node?.getSymbol();
  return (symbol?.getDeclarations().includes(declaration) ?? false)
    || (symbol?.getAliasedSymbol()?.getDeclarations().includes(declaration) ?? false);
};

const directCalls = (functionNode: ArrowFunction): CallExpression[] =>
  functionNode.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getFirstAncestor(Node.isFunctionLikeDeclaration) === functionNode
      && !isDefinitelyUnreachable(call, functionNode));


const inspectOwnerFilesystemWriters = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const mutatingFsApis = new Set([
    "appendFile", "appendFileSync", "mkdir", "mkdirSync", "rename", "renameSync",
    "rm", "rmSync", "unlink", "unlinkSync", "writeFile", "writeFileSync",
  ]);
  for (const sourceFile of context.project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    if (!filePath.includes("/scripts/audit/domains/")) continue;
    inspectedFiles.add(filePath);
    const importsMutation = sourceFile.getImportDeclarations().some((declaration) => {
      if (!["node:fs", "node:fs/promises"].includes(declaration.getModuleSpecifierValue())) return false;
      return declaration.getNamedImports().some((namedImport) => mutatingFsApis.has(namedImport.getName()));
    });
    const namespaceMutation = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
      const callee = call.getExpression();
      return Node.isPropertyAccessExpression(callee) && mutatingFsApis.has(callee.getName());
    });
    if (!importsMutation && !namespaceMutation) continue;
    findings.push(createFinding({
      checkId: "audit-system/runner-law-truth",
      lawId,
      filePath,
      message: "Owner inspector source must be read-only and return its report payload to the unique generated-plan writer.",
    }));
  }
};

const failureReceiptPrecedesSummary = (context: InspectorContext): boolean => {
  const source = context.project.getSourceFile(resolveFromRepo(failFastPath));
  const factory = source?.getVariableDeclaration("createFailFast")?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const handler = factory?.getBody();
  const completed = factory?.getParameters()[0];
  const failed = Node.isArrowFunction(handler) ? handler.getParameters()[2] : undefined;
  const calls = Node.isArrowFunction(handler) ? directCalls(handler) : [];
  const push = completed && failed ? calls.find((call) => {
    const callee = call.getExpression();
    return Node.isPropertyAccessExpression(callee) && callee.getName() === "push"
      && resolvesTo(callee.getExpression(), completed)
      && call.getArguments().some((argument) => resolvesTo(argument, failed));
  }) : undefined;
  const writer = source?.getImportDeclarations().find((item) => item.getModuleSpecifierValue() === "./ci-full-summary.js")
    ?.getNamedImports().find((item) => item.getName() === "writeCiFullSummary");
  const write = writer ? calls.find((call) => resolvesTo(call.getExpression(), writer)) : undefined;
  return push !== undefined && write !== undefined && push.getStart() < write.getStart();
};

const inspectRetiredWriters = (context: InspectorContext, findings: InspectorFinding[], lawId: string): void => {
  for (const name of ["writeRuntimeLogSpineReport", "writeFacebookLogCoverageReport"]) {
    const source = context.project.getSourceFiles().find((file) => file.getVariableDeclaration(name) || file.getFunction(name));
    if (!source) continue;
    findings.push(createFinding({ checkId: "audit-system/runner-law-truth", lawId,
      filePath: source.getFilePath(), message: `Retired owner-side generated report writer ${name} must be physically absent.` }));
  }
};

const inspectFailureReceiptAndRetiredWriters = (
  context: InspectorContext, findings: InspectorFinding[], inspectedFiles: Set<string>, lawId: string,
): void => {
  inspectedFiles.add(ciFullPath); inspectedFiles.add(failFastPath);
  if (!failureReceiptPrecedesSummary(context)) findings.push(createFinding({
    checkId: "audit-system/ci-full-entry-gate", lawId, filePath: failFastPath,
    message: "CI fail-fast must persist the failing physical step receipt before writing the terminal summary.",
  }));
  inspectRetiredWriters(context, findings, lawId);
};

export const inspectPhysicalCheckReceiptContract = (
  context: InspectorContext,
  lawId: string,
): { findings: InspectorFinding[]; inspectedFiles: string[] } => {
  const findings: InspectorFinding[] = [];
  const inspectedFiles = new Set<string>();
  inspectOwnerRegistrations(context, findings, inspectedFiles, lawId);
  inspectLegacyReceiptEscape(context, findings, inspectedFiles, lawId);
  inspectRunnerSession(context, findings, inspectedFiles, lawId);
  inspectAuditScriptEntrypoints(findings, inspectedFiles, lawId);
  inspectCiControlIntegrity(context, findings, inspectedFiles, lawId);
  inspectFailureReceiptAndRetiredWriters(context, findings, inspectedFiles, lawId);
  inspectOwnerFilesystemWriters(context, findings, inspectedFiles, lawId);
  const deliveryIsolation = inspectAcceptanceDeliveryIsolation(context, lawId);
  findings.push(...deliveryIsolation.findings);
  deliveryIsolation.inspectedFiles.forEach((filePath) => inspectedFiles.add(filePath));
  return { findings, inspectedFiles: [...inspectedFiles].sort() };
};
