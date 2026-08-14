import assert from "node:assert/strict";

import { Project, SyntaxKind } from "ts-morph";

import { inspectBinaryVerdictContract } from "../audit/domains/audit-system/binary-verdict-inspector.js";
import { loadGeneratedAuditPlan } from "../audit/core/load-audit-plan.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import type { InspectorContext, InspectorFinding } from "../audit/shared/inspector-contracts.js";
import { resolveFromRepo } from "../audit/shared/paths.js";

const contractsPath = resolveFromRepo("scripts/audit/shared/inspector-contracts.ts");

const buildContext = (project: Project): InspectorContext => {
  const generatedPlan = loadGeneratedAuditPlan();
  const planEntry = generatedPlan.find((entry) => entry.capabilityDomain === "audit-system");
  if (!planEntry) throw new Error("audit-system plan entry is missing.");
  return {
    checks: createInspectorCheckSession(planEntry, "acceptance-run:audit-binary-verdict").checks,
    completedReports: {},
    generatedPlan,
    planEntry,
    project,
  };
};

export const runBinaryVerdictAttacks = (): void => {
  const project = new Project({ tsConfigFilePath: resolveFromRepo("tsconfig.json") });
  const contracts = project.getSourceFileOrThrow(contractsPath);
  const status = contracts.getTypeAliasOrThrow("CompletedReport")
    .getDescendantsOfKind(SyntaxKind.PropertySignature)
    .find((property) => property.getName() === "status");
  if (!status?.getTypeNode()) throw new Error("binary verdict fixture could not find CompletedReport.status");
  status.getTypeNodeOrThrow().replaceWithText('"PASS" | "FAIL" | "DEGRADED"');
  const findings: InspectorFinding[] = [];
  inspectBinaryVerdictContract(buildContext(project), findings, new Set<string>(), "APEX-AUDIT-010-V1");
  assert.equal(findings.some((finding) => finding.checkId === "audit-system/binary-verdict"
    && finding.evidence?.includes("DEGRADED")), true,
  "binary verdict governance must reject every unknown third executable state.");
};
