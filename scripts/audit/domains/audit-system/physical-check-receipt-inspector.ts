import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type CallExpression,
  type Node as MorphNode,
  type SourceFile,
} from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import { astIdentifierName } from "../../shared/ast-node-identity.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { inspectAcceptanceDeliveryIsolation } from "./acceptance-delivery-isolation-inspector.js";
import { inspectCiControlIntegrity } from "./ci-control-integrity-inspector.js";
import { isDefinitelyUnreachable } from "./control-flow-reachability.js";
import { inspectOwnerRegistrations } from "./owner-registration-inspector.js";
import { inspectOwnerFilesystemWriters } from "./owner-filesystem-mutation-inspector.js";

const runnerPath = "scripts/audit/core/run-generated-plan.ts";
const sessionPath = "scripts/audit/shared/inspector-check-session.ts";
const contractsPath = "scripts/audit/shared/inspector-contracts.ts";
const packagePath = "package.json";
const ciFullPath = "scripts/audit/ci-full.ts";
const failFastPath = "scripts/audit/ci-fail-fast.ts";
const workflowsPath = ".github/workflows";

const listWorkflowFiles = (absoluteDirectory: string): string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const absolutePath = join(absoluteDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listWorkflowFiles(absolutePath));
      continue;
    }
    if (entry.isFile() && (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml"))) {
      files.push(absolutePath);
    }
  }
  return files;
};

export const inspectWorkflowEntrySurface = (
  lawId: string,
): { findings: InspectorFinding[]; inspectedFiles: string[] } => {
  const absoluteDirectory = resolveFromRepo(workflowsPath);
  if (!existsSync(absoluteDirectory)) return { findings: [], inspectedFiles: [workflowsPath] };
  const workflowFiles = listWorkflowFiles(absoluteDirectory);
  return {
    inspectedFiles: [workflowsPath, ...workflowFiles.map((filePath) => relative(resolveFromRepo("."), filePath))],
    findings: workflowFiles.map((filePath) => createFinding({
      checkId: "audit-system/runner-order-truth",
      lawId,
      filePath: relative(resolveFromRepo("."), filePath),
      message: "GitHub workflow entry is not authorized by the active local-only CI-FULL authority.",
    })),
  };
};

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

const isOwnerReceiptEvidenceHelperCall = (call: CallExpression): boolean => {
  const symbol = call.getExpression().getSymbol();
  const target = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
  return target?.getDeclarations().some((declaration) =>
    declaration.getSourceFile().getFilePath() === resolveFromRepo("scripts/audit/shared/law-contracts.ts")
      && ((Node.isFunctionDeclaration(declaration) && declaration.getName() === "evidenceModeRequiresOwnerReceipt")
        || (Node.isVariableDeclaration(declaration) && declaration.getName() === "evidenceModeRequiresOwnerReceipt"))) ?? false;
};

const ownerReceiptHelperConditionIsExact = (condition: MorphNode, parameter: MorphNode): boolean => {
  if (!Node.isCallExpression(condition) || !isOwnerReceiptEvidenceHelperCall(condition)) return false;
  const argument = condition.getArguments()[0];
  return Node.isPropertyAccessExpression(argument)
    && argument.getName() === "evidenceMode"
    && resolvesTo(argument.getExpression(), parameter);
};

const realChromeConditionIsExact = (condition: MorphNode, parameter: MorphNode): boolean => {
  const unwrapped = Node.isParenthesizedExpression(condition) ? condition.getExpression() : condition;
  if (ownerReceiptHelperConditionIsExact(unwrapped, parameter)) return true;
  if (!Node.isBinaryExpression(unwrapped)) return false;
  const left = unwrapped.getLeft();
  const right = unwrapped.getRight();
  return unwrapped.getOperatorToken().getKind() === SyntaxKind.ExclamationEqualsEqualsToken
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

const propertyValueResolvesTo = (property: MorphNode | undefined, declaration: MorphNode): boolean => {
  if (Node.isShorthandPropertyAssignment(property)) return resolvesTo(property.getNameNode(), declaration);
  return Node.isPropertyAssignment(property) && resolvesTo(property.getInitializer(), declaration);
};

const sessionFactoryRunIdentityIsBound = (session: SourceFile | undefined): boolean => {
  const factory = session?.getVariableDeclaration("createInspectorCheckSession")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const runIdParameter = factory?.getParameters()[1];
  const stateObject = factory?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "state")
    ?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
  return runIdParameter !== undefined
    && propertyValueResolvesTo(stateObject?.getProperty("runId"), runIdParameter);
};

const runnerRunIdentityDeclarations = (runner: SourceFile | undefined) => {
  const runPlan = runner?.getVariableDeclaration("runGeneratedPlanInternal")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const executeEntryDeclaration = runner?.getVariableDeclaration("executePlanEntry");
  const executeEntry = executeEntryDeclaration?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const runIdParameter = executeEntry?.getParameters().find((parameter) => parameter.getName() === "runId");
  const runIdDeclaration = runPlan?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "runId"
      && declaration.getFirstAncestor(Node.isFunctionLikeDeclaration) === runPlan);
  return { executeEntry, executeEntryDeclaration, runIdDeclaration, runIdParameter, runPlan };
};

const runnerCreatesOneRunIdentity = (
  runner: SourceFile | undefined,
  runIdDeclaration: MorphNode | undefined,
): boolean => {
  if (!Node.isVariableDeclaration(runIdDeclaration)) return false;
  const randomUuidImport = runner?.getImportDeclarations()
    .find((declaration) => declaration.getModuleSpecifierValue() === "node:crypto")
    ?.getNamedImports().find((specifier) => specifier.getName() === "randomUUID");
  return Boolean(runIdDeclaration.getInitializer()?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => randomUuidImport && resolvesTo(call.getExpression(), randomUuidImport)));
};

const runnerUsesOneSharedRunIdentity = (
  runner: SourceFile | undefined,
  session: SourceFile | undefined,
  sessionFactoryImport: MorphNode | undefined,
): boolean => {
  const { executeEntry, executeEntryDeclaration, runIdDeclaration, runIdParameter, runPlan } =
    runnerRunIdentityDeclarations(runner);
  const runIdParameterIndex = runIdParameter ? executeEntry?.getParameters().indexOf(runIdParameter) ?? -1 : -1;
  const sessionFactoryCall = executeEntry && sessionFactoryImport
    ? directCalls(executeEntry).find((call) => resolvesTo(call.getExpression(), sessionFactoryImport))
    : undefined;
  const executeEntryCall = runPlan && executeEntryDeclaration
    ? directCalls(runPlan).find((call) => resolvesTo(call.getExpression(), executeEntryDeclaration))
    : undefined;
  const validation = runner?.getVariableDeclaration("validateSessionInspectorOutput");
  const validationCall = executeEntry && validation
    ? directCalls(executeEntry).find((call) => resolvesTo(call.getExpression(), validation))
    : undefined;
  return runnerCreatesOneRunIdentity(runner, runIdDeclaration)
    && runIdParameter !== undefined
    && runIdDeclaration !== undefined
    && runIdParameterIndex >= 0
    && resolvesTo(sessionFactoryCall?.getArguments()[1], runIdParameter)
    && resolvesTo(executeEntryCall?.getArguments()[runIdParameterIndex], runIdDeclaration)
    && resolvesTo(validationCall?.getArguments()[2], runIdParameter)
    && sessionFactoryRunIdentityIsBound(session);
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
  if (!runnerUsesOneSharedRunIdentity(runner, session, sessionFactory)) {
    findings.push(createFinding({
      checkId: "audit-system/runner-law-truth",
      lawId,
      filePath: runnerPath,
      message: "Generated-plan runner must create one runId and inject that same identity into every owner session and receipt validator.",
    }));
  }
  if (sourceMappingExcludesRealChrome(session, "executedChecks")
    && sourceMappingExcludesRealChrome(runner, "expectedChecks")) return;
  findings.push(createFinding({ checkId: "audit-system/runner-law-truth", lawId, filePath: sessionPath,
    message: "Owner executedChecks and runner expectations must include every machine-bearing composite while excluding pure real-chrome bindings." }));
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
  const allowedAuditCommands = new Map([
    ["ci:full", "node --import tsx scripts/audit/ci-full.ts"],
    ["codex:entry-gate", "node --import tsx scripts/audit/codex-entry-gate.ts"],
  ]);
  for (const [name, command] of Object.entries(parsed.scripts ?? {})) {
    if (!command.includes("scripts/audit/")) continue;
    if (allowedAuditCommands.get(name) === command) continue;
    findings.push(createFinding({
      checkId: "audit-system/runner-order-truth",
      lawId,
      filePath: packagePath,
      message: `${name} exposes an audit command outside the unique ci:full and entry-gate surface.`,
      evidence: command,
    }));
  }
};

const inspectStandaloneAuditEntrypoints = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = relative(resolveFromRepo("."), sourceFile.getFilePath());
    if (!repoPath.startsWith("scripts/audit/") || repoPath === ciFullPath) continue;
    const entryDeclaration = sourceFile.getVariableDeclaration("isEntrypoint")
      ?? sourceFile.getFunction("isEntrypoint");
    const inlineEntry = sourceFile.getStatements().filter(Node.isIfStatement)
      .find((statement) => {
        const condition = statement.getExpression();
        const hasImportMetaUrl = condition
          .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
          .some((access) => access.getName() === "url"
            && access.getExpression().getKind() === SyntaxKind.MetaProperty);
        const hasProcessArgv = condition
          .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
          .some((access) => access.getName() === "argv"
            && astIdentifierName(access.getExpression()) === "process");
        return hasImportMetaUrl && hasProcessArgv;
      });
    if (!entryDeclaration && !inlineEntry) continue;
    inspectedFiles.add(repoPath);
    findings.push(createFinding({
      checkId: "audit-system/runner-order-truth",
      lawId,
      filePath: repoPath,
      message: `${repoPath} retains a named or inline standalone audit entrypoint outside the unique ci:full surface.`,
    }));
  }
};

const resolvesTo = (node: MorphNode | undefined, declaration: MorphNode): boolean => {
  const symbol = node?.getSymbol();
  return (symbol?.getDeclarations().includes(declaration) ?? false)
    || (symbol?.getAliasedSymbol()?.getDeclarations().includes(declaration) ?? false)
    || (Node.isIdentifier(node)
      && node.getDefinitions().some((definition) => definition.getDeclarationNode() === declaration));
};

const directCalls = (functionNode: ArrowFunction): CallExpression[] =>
  functionNode.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getFirstAncestor(Node.isFunctionLikeDeclaration) === functionNode
      && !isDefinitelyUnreachable(call, functionNode));

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

const inspectFailureReceipt = (
  context: InspectorContext, findings: InspectorFinding[], inspectedFiles: Set<string>, lawId: string,
): void => {
  inspectedFiles.add(ciFullPath); inspectedFiles.add(failFastPath);
  if (!failureReceiptPrecedesSummary(context)) findings.push(createFinding({
    checkId: "audit-system/ci-full-entry-gate", lawId, filePath: failFastPath,
    message: "CI fail-fast must persist the failing physical step receipt before writing the terminal summary.",
  }));
};

export const inspectRetiredEnforcementSurfaces = (
  context: InspectorContext,
  lawId: string,
): { findings: InspectorFinding[]; inspectedFiles: string[] } => {
  const findings: InspectorFinding[] = [];
  const inspectedFiles = new Set<string>();
  inspectLegacyReceiptEscape(context, findings, inspectedFiles, lawId);
  inspectAuditScriptEntrypoints(findings, inspectedFiles, lawId);
  inspectStandaloneAuditEntrypoints(context, findings, inspectedFiles, lawId);
  inspectRetiredWriters(context, findings, lawId);
  return { findings, inspectedFiles: [...inspectedFiles].sort() };
};

export type PhysicalCheckContractLawIds = Readonly<{
  binaryVerdict: string;
  deletion: string;
  enforcementTruth: string;
  runner: string;
}>;

export const inspectPhysicalCheckReceiptContract = (
  context: InspectorContext,
  lawIds: PhysicalCheckContractLawIds,
): { findings: InspectorFinding[]; inspectedFiles: string[] } => {
  const findings: InspectorFinding[] = [];
  const inspectedFiles = new Set<string>();
  inspectOwnerRegistrations(context, findings, inspectedFiles, lawIds.enforcementTruth);
  inspectRunnerSession(context, findings, inspectedFiles, lawIds.runner);
  inspectCiControlIntegrity(context, findings, inspectedFiles, lawIds.runner);
  inspectFailureReceipt(context, findings, inspectedFiles, lawIds.binaryVerdict);
  inspectOwnerFilesystemWriters(context, findings, inspectedFiles, lawIds.enforcementTruth);
  const retired = inspectRetiredEnforcementSurfaces(context, lawIds.deletion);
  findings.push(...retired.findings);
  retired.inspectedFiles.forEach((filePath) => inspectedFiles.add(filePath));
  const deliveryIsolation = inspectAcceptanceDeliveryIsolation(context, lawIds.runner);
  findings.push(...deliveryIsolation.findings);
  deliveryIsolation.inspectedFiles.forEach((filePath) => inspectedFiles.add(filePath));
  return { findings, inspectedFiles: [...inspectedFiles].sort() };
};
