import assert from "node:assert/strict";

import { Project, SyntaxKind } from "ts-morph";

import { inspectRunnerSessionContract } from "../audit/domains/audit-system/physical-check-receipt-inspector.js";
import { loadGeneratedAuditPlan } from "../audit/core/load-audit-plan.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import type { InspectorContext } from "../audit/shared/inspector-contracts.js";
import { resolveFromRepo } from "../audit/shared/paths.js";

const buildContext = (project: Project): InspectorContext => {
  const generatedPlan = loadGeneratedAuditPlan();
  const planEntry = generatedPlan.find((entry) => entry.capabilityDomain === "audit-system");
  if (!planEntry) throw new Error("audit-system plan entry is missing.");
  return {
    checks: createInspectorCheckSession(planEntry, "acceptance-run:audit-run-identity").checks,
    completedReports: {},
    generatedPlan,
    planEntry,
    project,
  };
};

export const runAuditRunIdentityAttacks = (): void => {
  const project = new Project({ tsConfigFilePath: resolveFromRepo("tsconfig.json") });
  const runner = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/core/run-generated-plan.ts"));
  const executeEntry = runner.getVariableDeclarationOrThrow("executePlanEntry")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  const factoryCall = executeEntry.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => call.getExpression().getSymbol()?.getEscapedName().toString() === "createInspectorCheckSession");
  const runIdArgument = factoryCall?.getArguments()[1];
  if (!runIdArgument) throw new Error("shared runId fixture could not find the owner session injection point");
  runIdArgument.replaceWithText('"audit-run:owner-local"');
  const result = inspectRunnerSessionContract(buildContext(project), "APEX-AUDIT-005-V1");
  assert.equal(result.findings.some((finding) =>
    finding.checkId === "audit-system/runner-law-truth" && finding.message.includes("one runId")), true,
  "receipt governance must reject an owner-local runId that fragments the generated-plan run identity.");
};
