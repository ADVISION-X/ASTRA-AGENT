import assert from "node:assert/strict";

import { Project, VariableDeclarationKind } from "ts-morph";

import { loadGeneratedAuditPlan } from "../audit/core/load-audit-plan.js";
import { inspectDomain as inspectAuditSystemDomain } from "../audit/domains/audit-system/inspector.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import type { InspectorContext } from "../audit/shared/inspector-contracts.js";
import { resolveFromRepo } from "../audit/shared/paths.js";

const generatedPlanRunnerPath = resolveFromRepo("scripts/audit/core/run-generated-plan.ts");

const buildContext = (project: Project): InspectorContext => {
  const generatedPlan = loadGeneratedAuditPlan();
  const planEntry = generatedPlan.find((entry) => entry.capabilityDomain === "audit-system");
  if (!planEntry) throw new Error("audit-system plan entry is missing.");
  return {
    checks: createInspectorCheckSession(planEntry, "acceptance-run:audit-runner-law-truth").checks,
    completedReports: {},
    generatedPlan,
    planEntry,
    project,
  };
};

export const runGrasseyeRunnerLawTruthAttack = async (): Promise<void> => {
  const project = new Project({ tsConfigFilePath: resolveFromRepo("tsconfig.json") });
  project.getSourceFileOrThrow(generatedPlanRunnerPath).addVariableStatement({
    declarationKind: VariableDeclarationKind.Const,
    declarations: [{ name: "injectedRunnerLawTruth", initializer: '"GRASSEYE-INJECTED-RUNNER-LAW-V1"' }],
  });
  const result = await inspectAuditSystemDomain(buildContext(project));
  assert.equal(
    result.findings.some((finding) =>
      finding.checkId === "audit-system/runner-law-truth"
      && finding.message.includes("GRASSEYE-INJECTED-RUNNER-LAW-V1")),
    true,
    "runner law-truth governance must reject canonical GRASSEYE law literals as well as APEX law literals.",
  );
};
