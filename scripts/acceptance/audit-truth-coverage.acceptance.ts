import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Project } from "ts-morph";

import { inspectDomain } from "../audit/domains/audit-truth/inspector.js";
import type { InspectorContext, InspectorFinding } from "../audit/shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../audit/shared/paths.js";

const RUNTIME_ROOT = resolveFromRepo("tmp/audit-truth-acceptance-runtime");
const LAW_IDS = ["APEX-AUDIT-TRUTH-001-V1", "APEX-AUDIT-TRUTH-002-V1"];

const createRuntimeProject = (caseName: string, files: Record<string, string>): { project: Project; runtimeRepoPath: string } => {
  const runtimeDir = path.join(RUNTIME_ROOT, caseName);
  rmSync(runtimeDir, { force: true, recursive: true });
  mkdirSync(runtimeDir, { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(runtimeDir, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }
  writeFileSync(
    path.join(runtimeDir, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          target: "ES2022",
        },
        include: ["scripts/**/*.ts"],
      },
      null,
      2,
    )}\n`,
  );
  return {
    project: new Project({ tsConfigFilePath: path.join(runtimeDir, "tsconfig.json") }),
    runtimeRepoPath: toRepoPath(runtimeDir),
  };
};

const createContext = (
  project: Project,
  generatedPlan: InspectorContext["generatedPlan"],
): InspectorContext => ({
  completedReports: {},
  generatedPlan,
  planEntry: {
    capabilityDomain: "audit-truth",
    clauseIds: ["primary"],
    evidenceModes: ["ast+project"],
    executionGroup: "meta",
    lawIds: LAW_IDS,
    manifestPath: "scripts/audit/domains/audit-truth/manifest.json",
    ownerInspectorPath: "scripts/audit/domains/audit-truth/inspector.ts",
    blueprintRefs: [],
  },
  project,
});

const hasFinding = (
  findings: readonly InspectorFinding[],
  input: { checkId: string; fileIncludes: string },
): boolean =>
  findings.some(
    (finding) => finding.checkId === input.checkId && finding.filePath?.includes(input.fileIncludes),
  );

const projectUsageCase = createRuntimeProject("project-usage", {
  "scripts/audit/domains/alpha/inspector.ts": `
export const inspectDomain = async (_context: unknown) => ({
  capabilityDomain: "alpha",
  reportedLawIds: ["APEX-AUDIT-TRUTH-001-V1"],
  findings: [],
  inspectedFiles: [],
});
`,
  "scripts/audit/domains/beta/inspector.ts": `
export const inspectDomain = async (context: { project: { getSourceFiles(): Array<{ getFullText(): string }> } }) => {
  const files = context.project.getSourceFiles();
  const hasText = files[0]?.getFullText().includes("alpha");
  return {
    capabilityDomain: "beta",
    reportedLawIds: ["APEX-AUDIT-TRUTH-001-V1"],
    findings: hasText ? [] : [],
    inspectedFiles: [],
  };
};
`,
  "scripts/audit/domains/regex/inspector.ts": `
export const inspectDomain = async (context: { project: { getSourceFiles(): Array<{ getFullText(): string }> } }) => {
  const files = context.project.getSourceFiles();
  const hasAlpha = /alpha/u.test(files[0]?.getFullText() ?? "");
  return {
    capabilityDomain: "regex",
    reportedLawIds: ["APEX-AUDIT-TRUTH-001-V1"],
    findings: hasAlpha ? [] : [],
    inspectedFiles: [],
  };
};
`,
});

const projectUsageOutput = await inspectDomain(
  createContext(projectUsageCase.project, [
    {
      blueprintRefs: [],
      capabilityDomain: "alpha",
      clauseIds: ["primary"],
      evidenceModes: ["ast+project"],
      executionGroup: "meta",
      lawIds: LAW_IDS,
      manifestPath: `${projectUsageCase.runtimeRepoPath}/scripts/audit/domains/alpha/manifest.json`,
      ownerInspectorPath: `${projectUsageCase.runtimeRepoPath}/scripts/audit/domains/alpha/inspector.ts`,
    },
  ]),
);

assert.equal(
  hasFinding(projectUsageOutput.findings, {
    checkId: "audit-truth/inspector-project-usage",
    fileIncludes: "/scripts/audit/domains/alpha/inspector.ts",
  }),
  true,
  "audit-truth should fail inspectors that do not use context.project.",
);
assert.equal(
  hasFinding(projectUsageOutput.findings, {
    checkId: "audit-truth/source-text-judgment",
    fileIncludes: "/scripts/audit/domains/beta/inspector.ts",
  }),
  true,
  "audit-truth should fail tracked source-text judgment in owner inspectors.",
);
assert.equal(
  hasFinding(projectUsageOutput.findings, {
    checkId: "audit-truth/source-regex-judgment",
    fileIncludes: "/scripts/audit/domains/regex/inspector.ts",
  }),
  true,
  "audit-truth should fail regex-based structural judgment in owner inspectors.",
);
assert.equal(
  hasFinding(projectUsageOutput.findings, {
    checkId: "audit-truth/missing-generated-plan-entry",
    fileIncludes: "/scripts/audit/domains/beta/inspector.ts",
  }),
  true,
  "audit-truth should fail when a real owner inspector is missing from generated plan coverage.",
);

const orphanPlanCase = createRuntimeProject("orphan-plan", {
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

const orphanPlanOutput = await inspectDomain(
  createContext(orphanPlanCase.project, [
    {
      blueprintRefs: [],
      capabilityDomain: "gamma",
      clauseIds: ["primary"],
      evidenceModes: ["ast+project"],
      executionGroup: "meta",
      lawIds: LAW_IDS,
      manifestPath: `${orphanPlanCase.runtimeRepoPath}/scripts/audit/domains/gamma/manifest.json`,
      ownerInspectorPath: `${orphanPlanCase.runtimeRepoPath}/scripts/audit/domains/gamma/inspector.ts`,
    },
    {
      blueprintRefs: [],
      capabilityDomain: "ghost",
      clauseIds: ["primary"],
      evidenceModes: ["ast+project"],
      executionGroup: "meta",
      lawIds: LAW_IDS,
      manifestPath: `${orphanPlanCase.runtimeRepoPath}/scripts/audit/domains/ghost/manifest.json`,
      ownerInspectorPath: `${orphanPlanCase.runtimeRepoPath}/scripts/audit/domains/ghost/inspector.ts`,
    },
  ]),
);

assert.equal(
  hasFinding(orphanPlanOutput.findings, {
    checkId: "audit-truth/orphan-generated-plan-entry",
    fileIncludes: "/scripts/audit/domains/ghost/inspector.ts",
  }),
  true,
  "audit-truth should fail orphan generated-plan owner inspector entries.",
);

rmSync(RUNTIME_ROOT, { force: true, recursive: true });
console.log("audit-truth-coverage-acceptance-ok");