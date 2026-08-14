import assert from "node:assert/strict";

import { Node, Project, SyntaxKind } from "ts-morph";

import { inspectCiControlIntegrity } from "../audit/domains/audit-system/ci-control-integrity-inspector.js";
import { loadGeneratedAuditPlan } from "../audit/core/load-audit-plan.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import type { InspectorContext } from "../audit/shared/inspector-contracts.js";
import { resolveFromRepo } from "../audit/shared/paths.js";

const runnerPath = resolveFromRepo("scripts/audit/ci-audit-plan-runner.ts");
const attackProject = new Project({ tsConfigFilePath: resolveFromRepo("tsconfig.json") });
const resetAttackProject = (): Project => {
  attackProject.getSourceFileOrThrow(runnerPath).refreshFromFileSystemSync();
  return attackProject;
};

const buildContext = (project: Project): InspectorContext => {
  const generatedPlan = loadGeneratedAuditPlan();
  const planEntry = generatedPlan.find((entry) => entry.capabilityDomain === "audit-system");
  if (!planEntry) throw new Error("audit-system plan entry is missing.");
  return { checks: createInspectorCheckSession(planEntry, "acceptance-run:audit-worker-lifecycle").checks, completedReports: {}, generatedPlan, planEntry, project };
};

const exitCallback = (project: Project) => {
  const source = project.getSourceFileOrThrow(runnerPath);
  const listener = source.getVariableDeclarationOrThrow("runGeneratedPlanWithDeadline")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction)
    .getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
      const callee = call.getExpression();
      const event = call.getArguments()[0];
      return Node.isPropertyAccessExpression(callee) && callee.getName() === "once"
        && Node.isStringLiteral(event) && event.getLiteralValue() === "exit";
    });
  return listener?.getArguments()[1]?.asKindOrThrow(SyntaxKind.ArrowFunction);
};

const resolvesTo = (node: Node | undefined, declaration: Node): boolean => {
  const symbol = node?.getSymbol();
  return (symbol?.getDeclarations().includes(declaration) ?? false)
    || (symbol?.getAliasedSymbol()?.getDeclarations().includes(declaration) ?? false);
};

const isNonZeroExitGuard = (guard: import("ts-morph").IfStatement, callback: import("ts-morph").ArrowFunction): boolean => {
  const code = callback.getParameters()[0];
  const condition = guard.getExpression();
  const right = Node.isBinaryExpression(condition) ? condition.getRight() : undefined;
  return code !== undefined && Node.isBinaryExpression(condition)
    && condition.getOperatorToken().getKind() === SyntaxKind.ExclamationEqualsEqualsToken
    && resolvesTo(condition.getLeft(), code)
    && Node.isNumericLiteral(right) && right.getLiteralValue() === 0;
};

const isMissingResultGuard = (guard: import("ts-morph").IfStatement, callback: import("ts-morph").ArrowFunction): boolean => {
  const pending = callback.getFirstAncestorByKind(SyntaxKind.Block)
    ?.getVariableDeclaration("pendingResult");
  const condition = guard.getExpression();
  return pending !== undefined && Node.isPrefixUnaryExpression(condition)
    && condition.getOperatorToken() === SyntaxKind.ExclamationToken
    && resolvesTo(condition.getOperand(), pending);
};

const assertExitGuardRequired = (
  condition: (guard: import("ts-morph").IfStatement, callback: import("ts-morph").ArrowFunction) => boolean,
  label: string,
): void => {
  const project = resetAttackProject();
  const callback = exitCallback(project);
  const guard = callback?.getDescendantsOfKind(SyntaxKind.IfStatement)
    .find((item) => condition(item, callback));
  guard?.replaceWithText("void 0;");
  const findings: import("../audit/shared/inspector-contracts.js").InspectorFinding[] = [];
  inspectCiControlIntegrity(buildContext(project), findings, new Set<string>(), "APEX-AUDIT-005-V1");
  assert.equal(findings.some((finding) => finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("hard deadline")), true, `worker lifecycle must reject ${label}.`);
};

const runConditionallyHiddenExitGuardsAttack = (): void => {
  const project = resetAttackProject();
  const callback = exitCallback(project);
  if (!callback) throw new Error("worker exit callback fixture is missing.");
  const guards = callback.getBody().asKindOrThrow(SyntaxKind.Block).getStatements()
    .filter(Node.isIfStatement)
    .filter((guard) => isNonZeroExitGuard(guard, callback) || isMissingResultGuard(guard, callback));
  if (guards.length !== 2) throw new Error("worker exit guard fixtures are missing.");
  for (const guard of guards) guard.replaceWithText(`if (Number.isNaN(0)) { ${guard.getText()} }`);
  const findings: import("../audit/shared/inspector-contracts.js").InspectorFinding[] = [];
  inspectCiControlIntegrity(buildContext(project), findings, new Set<string>(), "APEX-AUDIT-005-V1");
  assert.equal(findings.some((finding) => finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("hard deadline")), true,
  "worker lifecycle must reject exit guards hidden inside an unrecognized constant-false branch.");
};

const runAuthenticatedResultOverwriteAttack = (): void => {
  const project = resetAttackProject();
  const source = project.getSourceFileOrThrow(runnerPath);
  const run = source.getVariableDeclarationOrThrow("runGeneratedPlanWithDeadline")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  const validation = run.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => Node.isIdentifier(call.getExpression())
      && call.getExpression().getText() === "validateGeneratedPlanWorkerResult");
  const assignmentStatement = validation?.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
  if (!assignmentStatement) throw new Error("worker result validation fixture is missing.");
  assignmentStatement.replaceWithText(`${assignmentStatement.getText()}
    pendingResult = { domainReports: [], hasFailures: false } as PlanRunResult;`);
  const findings: import("../audit/shared/inspector-contracts.js").InspectorFinding[] = [];
  inspectCiControlIntegrity(buildContext(project), findings, new Set<string>(), "APEX-AUDIT-005-V1");
  assert.equal(findings.some((finding) => finding.checkId === "audit-system/ci-full-entry-gate"
    && finding.message.includes("hard deadline")), true,
  "worker lifecycle must reject overwriting the authenticated result before terminal resolution.");
};

export const runWorkerLifecycleAttacks = (): void => {
  assertExitGuardRequired(isNonZeroExitGuard, "success without exit-code proof");
  assertExitGuardRequired(isMissingResultGuard, "success without an authenticated result guard");
  runConditionallyHiddenExitGuardsAttack();
  runAuthenticatedResultOverwriteAttack();
};
