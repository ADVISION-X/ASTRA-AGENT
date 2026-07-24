import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Project } from "ts-morph";

import { inspectDomain } from "../audit/domains/audit-truth/inspector.js";
import { validateInspectorOutput } from "../audit/core/run-generated-plan.js";
import { auditManifestSchema } from "../audit/shared/manifest-contracts.js";
import type { InspectorContext, InspectorFinding } from "../audit/shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../audit/shared/paths.js";

const RUNTIME_ROOT = resolveFromRepo("tmp/audit-truth-acceptance-runtime");
const LAW_IDS = [
  "APEX-AUDIT-TRUTH-001-V1",
  "GRASSEYE-AUDIT-META-QUALITY-AST-SYMBOL-NO-REGEX-V1",
  "APEX-AUDIT-TRUTH-002-V1",
];

const createBindings = (lawIds: readonly string[], ownerInspectorPath: string) =>
  lawIds.map((lawId) => ({
    lawId,
    clauseId: `${lawId.toLowerCase()}-fixture-requirement`,
    evidenceMode: "static" as const,
    checkIds: ["fixture/check"],
    sourceEvidence: [{ filePath: ownerInspectorPath, symbolName: "inspectDomain" }],
  }));

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
    bindings: createBindings(LAW_IDS, "scripts/audit/domains/audit-truth/inspector.ts"),
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
  "scripts/audit/ci-full.ts": `
import { runGeneratedPlanFiltered } from "./core/run-generated-plan.js";
export const runCi = () => runGeneratedPlanFiltered({ capabilityDomains: ["audit-truth"] });
`,
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
  "scripts/audit/shared/text-helper.ts": `
export const hasAlphaText = (sourceFile: { getFullText(): string }) => {
  const fullText = sourceFile.getFullText();
  return fullText.includes("alpha");
};
`,
  "scripts/audit/domains/raw-file/inspector.ts": `
import { readFileSync } from "node:fs";

export const inspectDomain = async (context: { project: { getSourceFiles(): unknown[] } }) => {
  void context.project.getSourceFiles().length;
  const sourceText = readFileSync("src/example.ts", "utf8");
  const hasToken = sourceText.includes("forbiddenToken");
  return {
    capabilityDomain: "raw-file",
    reportedLawIds: ["APEX-AUDIT-TRUTH-001-V1"],
    findings: hasToken ? [] : [],
    inspectedFiles: [],
  };
};
`,
  "scripts/audit/shared/raw-file-helper.ts": `
import { readFileSync } from "node:fs";

export const readRepoText = (repoPath: string): string => readFileSync(repoPath, "utf8");
export const requireTokens = (text: string, tokens: readonly string[]): boolean =>
  tokens.every((token) => text.includes(token));
`,
  "scripts/audit/domains/helper-laundering/inspector.ts": `
import { readRepoText, requireTokens } from "../../shared/raw-file-helper.js";

export const inspectDomain = async (context: { project: { getSourceFiles(): unknown[] } }) => {
  void context.project.getSourceFiles().length;
  const sourceBundle = { runtimeText: readRepoText("src/runtime.ts") };
  const passed = requireTokens(sourceBundle.runtimeText, ["runRuntime"]);
  return {
    capabilityDomain: "helper-laundering",
    reportedLawIds: ["APEX-AUDIT-TRUTH-001-V1"],
    findings: passed ? [] : [],
    inspectedFiles: [],
  };
};
`,
  "scripts/audit/domains/audit-truth/meta-quality-regexp.ts": `
const ConstructorAlias = RegExp;
const pattern = new ConstructorAlias("alpha");
void pattern;
`,
  "scripts/acceptance/meta-quality-proof.acceptance.ts": `
import { createAuditProject } from "../audit/shared/project.js";

const method = "match";
const text = "alpha";
const result = text[method]("alpha");

void createAuditProject;
void result;
`,
  "scripts/acceptance/meta-quality-source-text.acceptance.ts": `
import { createAuditProject } from "../audit/shared/project.js";

const project = createAuditProject();
const sourceFile = project.getSourceFiles()[0];
const fullText = sourceFile.getFullText();
const hasAlpha = fullText.includes("alpha");

void hasAlpha;
`,
});

const projectUsageOutput = await inspectDomain(
  createContext(projectUsageCase.project, [
    {
      blueprintRefs: [],
      capabilityDomain: "alpha",
      bindings: createBindings(LAW_IDS, `${projectUsageCase.runtimeRepoPath}/scripts/audit/domains/alpha/inspector.ts`),
      executionGroup: "meta",
      lawIds: LAW_IDS,
      manifestPath: `${projectUsageCase.runtimeRepoPath}/scripts/audit/domains/alpha/manifest.json`,
      ownerInspectorPath: `${projectUsageCase.runtimeRepoPath}/scripts/audit/domains/alpha/inspector.ts`,
    },
  ]),
);

assert.equal(
  projectUsageOutput.reportedLawIds.includes("GRASSEYE-AUDIT-META-QUALITY-AST-SYMBOL-NO-REGEX-V1"),
  true,
  "audit-truth should report the active meta-quality law in its owner output.",
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
    checkId: "audit-truth/source-text-judgment",
    fileIncludes: "/scripts/audit/shared/text-helper.ts",
  }),
  true,
  "audit-truth should fail tracked source-text judgment in shared audit helpers.",
);
assert.equal(
  hasFinding(projectUsageOutput.findings, {
    checkId: "audit-truth/source-text-judgment",
    fileIncludes: "/scripts/audit/domains/raw-file/inspector.ts",
  }),
  true,
  "audit-truth should fail readFileSync source-text judgment in owner inspectors.",
);
assert.equal(
  hasFinding(projectUsageOutput.findings, {
    checkId: "audit-truth/source-text-judgment",
    fileIncludes: "/scripts/audit/domains/helper-laundering/inspector.ts",
  }),
  true,
  "audit-truth should fail source text laundered through a helper and object property.",
);
assert.equal(
  hasFinding(projectUsageOutput.findings, {
    checkId: "audit-truth/meta-quality-regex-constructor",
    fileIncludes: "/scripts/audit/domains/audit-truth/meta-quality-regexp.ts",
  }),
  true,
  "audit-truth should fail RegExp constructor use inside the audit meta-quality owner scope.",
);
assert.equal(
  hasFinding(projectUsageOutput.findings, {
    checkId: "audit-truth/meta-quality-dynamic-method-escape",
    fileIncludes: "/scripts/acceptance/meta-quality-proof.acceptance.ts",
  }),
  true,
  "audit-truth should fail dynamic banned-method escapes inside audit meta-quality proof scripts.",
);
assert.equal(
  hasFinding(projectUsageOutput.findings, {
    checkId: "audit-truth/source-text-judgment",
    fileIncludes: "/scripts/acceptance/meta-quality-source-text.acceptance.ts",
  }),
  true,
  "audit-truth should fail tracked source-text judgment inside audit meta-quality proof scripts.",
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
      bindings: createBindings(LAW_IDS, `${orphanPlanCase.runtimeRepoPath}/scripts/audit/domains/gamma/inspector.ts`),
      executionGroup: "meta",
      lawIds: LAW_IDS,
      manifestPath: `${orphanPlanCase.runtimeRepoPath}/scripts/audit/domains/gamma/manifest.json`,
      ownerInspectorPath: `${orphanPlanCase.runtimeRepoPath}/scripts/audit/domains/gamma/inspector.ts`,
    },
    {
      blueprintRefs: [],
      capabilityDomain: "ghost",
      bindings: createBindings(LAW_IDS, `${orphanPlanCase.runtimeRepoPath}/scripts/audit/domains/ghost/inspector.ts`),
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

assert.equal(
  hasFinding(projectUsageOutput.findings, {
    checkId: "audit-truth/ci-owner-special-case",
    fileIncludes: "/scripts/audit/ci-full.ts",
  }),
  true,
  "audit-truth should fail CI orchestration that hardcodes a filtered owner run.",
);

assert.equal(
  auditManifestSchema.safeParse({
    capabilityDomain: "legacy",
    ownerInspectorPath: "scripts/audit/domains/legacy/inspector.ts",
    executionGroup: "domain",
    coverage: {
      mode: "domain-wide",
      clauseIds: ["primary"],
    },
  }).success,
  false,
  "manifest contract must reject domain-wide primary placeholder coverage.",
);

const missingReceiptPlan = createContext(projectUsageCase.project, []).planEntry;
const missingReceiptOutput = validateInspectorOutput(missingReceiptPlan, {
  capabilityDomain: missingReceiptPlan.capabilityDomain,
  reportedLawIds: missingReceiptPlan.lawIds,
  executedChecks: [],
  findings: [],
  inspectedFiles: [missingReceiptPlan.ownerInspectorPath],
});
assert.equal(
  missingReceiptOutput.findings.some((finding) =>
    finding.checkId === "runner/inspector-error"
    && finding.message.includes("omitted executed check")),
  true,
  "runner must fail an empty-finding inspector that omits a planned executed-check receipt.",
);

rmSync(RUNTIME_ROOT, { force: true, recursive: true });
console.log("audit-truth-coverage-acceptance-ok");
