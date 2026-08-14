import assert from "node:assert/strict";

import { inspectDomain } from "../audit/domains/audit-truth/inspector.js";
import {
  LAW_IDS,
  createBindings,
  createContext,
  createRuntimeProject,
  hasFinding,
} from "./audit-truth-coverage-fixture.js";

export const runAuditTruthOrphanPlanAttack = async (): Promise<void> => {
  const runtimeCase = createRuntimeProject("orphan-plan", {
    "scripts/audit/domains/gamma/inspector.ts": `
export const inspectDomain = async (context: { project: { getSourceFiles(): unknown[] } }) => {
  void context.project.getSourceFiles().length;
  return {
    capabilityDomain: "gamma",
    reportedLawIds: ["APEX-AUDIT-TRUTH-001-V1"],
    findings: [],
    inspectedFiles: [],
  };
};
`,
  });
  const gammaInspector = `${runtimeCase.runtimeRepoPath}/scripts/audit/domains/gamma/inspector.ts`;
  const ghostInspector = `${runtimeCase.runtimeRepoPath}/scripts/audit/domains/ghost/inspector.ts`;
  const output = await inspectDomain(createContext(runtimeCase.project, [
    {
      blueprintRefs: [],
      capabilityDomain: "gamma",
      bindings: createBindings(LAW_IDS, gammaInspector),
      executionGroup: "meta",
      lawIds: LAW_IDS,
      manifestPath: `${runtimeCase.runtimeRepoPath}/scripts/audit/domains/gamma/manifest.json`,
      ownerInspectorPath: gammaInspector,
    },
    {
      blueprintRefs: [],
      capabilityDomain: "ghost",
      bindings: createBindings(LAW_IDS, ghostInspector),
      executionGroup: "meta",
      lawIds: LAW_IDS,
      manifestPath: `${runtimeCase.runtimeRepoPath}/scripts/audit/domains/ghost/manifest.json`,
      ownerInspectorPath: ghostInspector,
    },
  ]));

  assert.equal(hasFinding(output.findings, {
    checkId: "audit-truth/inspector-project-usage",
    fileIncludes: "/scripts/audit/domains/gamma/inspector.ts",
  }), true, "a discarded context.project access must not qualify as project-backed AST enforcement.");
  assert.equal(hasFinding(output.findings, {
    checkId: "audit-truth/orphan-generated-plan-entry",
    fileIncludes: "/scripts/audit/domains/ghost/inspector.ts",
  }), true, "audit-truth should fail orphan generated-plan owner inspector entries.");
};
