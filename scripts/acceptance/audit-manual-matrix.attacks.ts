import assert from "node:assert/strict";

import { Project } from "ts-morph";

import { inspectManualMatrixConsumption } from "../audit/domains/audit-system/manual-matrix-consumption-inspector.js";
import { loadGeneratedAuditPlan } from "../audit/core/load-audit-plan.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import type { InspectorContext } from "../audit/shared/inspector-contracts.js";
import { resolveFromRepo } from "../audit/shared/paths.js";

const buildContext = (project: Project): InspectorContext => {
  const generatedPlan = loadGeneratedAuditPlan();
  const planEntry = generatedPlan.find((entry) => entry.capabilityDomain === "audit-system");
  if (!planEntry) throw new Error("audit-system plan entry is missing.");
  return {
    checks: createInspectorCheckSession(planEntry, "acceptance-run:audit-manual-matrix").checks,
    completedReports: {}, generatedPlan, planEntry, project,
  };
};

const hasFinding = (project: Project): boolean =>
  inspectManualMatrixConsumption(buildContext(project), "APEX-AUDIT-008-V1").findings.length > 0;

export const runManualMatrixAttacks = (): void => {
  const baseline = new Project({ tsConfigFilePath: resolveFromRepo("tsconfig.json") });
  assert.equal(hasFinding(baseline), false, "the canonical runner must not consume a manual matrix.");

  const importAttack = new Project({ tsConfigFilePath: resolveFromRepo("tsconfig.json") });
  importAttack.createSourceFile(resolveFromRepo("scripts/audit/manual-matrix-attack.fixture.ts"),
    "export const manualMatrix = [];\n", { overwrite: true });
  importAttack.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-full.ts"))
    .addImportDeclaration({ moduleSpecifier: "./manual-matrix-attack.fixture.js", namedImports: ["manualMatrix"] });
  assert.equal(hasFinding(importAttack), true, "runner imports of a manual matrix must fail closed.");

  const readAttack = new Project({ tsConfigFilePath: resolveFromRepo("tsconfig.json") });
  readAttack.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-full.ts"))
    .addStatements('readFileSync(resolveFromRepo("scripts/audit/manual-enforcement-matrix.json"), "utf8");');
  assert.equal(hasFinding(readAttack), true, "runner reads of a manual matrix must fail closed.");
};
