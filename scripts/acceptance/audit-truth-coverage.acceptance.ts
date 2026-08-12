import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { inspectDomain } from "../audit/domains/audit-truth/inspector.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import { auditManifestSchema } from "../audit/shared/manifest-contracts.js";
import { LAW_IDS, RUNTIME_ROOT, createBindings, createContext, createRuntimeProject, hasFinding } from "./audit-truth-coverage-fixture.js";


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
  "scripts/audit/domains/type-text/inspector.ts": `
export const inspectDomain = async (context: { project: { getSourceFiles(): unknown[] } }) => {
  void context.project.getSourceFiles().length;
  const controllerType = null as unknown as { getText(): string };
  const controllerTypeName = controllerType.getText();
  const isController = controllerTypeName.includes("BrowserController");
  return {
    capabilityDomain: "type-text",
    reportedLawIds: ["APEX-AUDIT-TRUTH-001-V1"],
    findings: isController ? [] : [],
    inspectedFiles: [],
  };
};
`,
  "scripts/audit/domains/audit-system/text-equality-inspector.ts": `
export const inspectDomain = async (context: { project: { getSourceFiles(): Array<{ getDescendants(): Array<{ getText(): string }> }> } }) => {
  const sourceFile = context.project.getSourceFiles()[0];
  const nodeText = sourceFile?.getDescendants()[0]?.getText();
  const isExpectedCall = nodeText === "setTimeout";
  return {
    capabilityDomain: "text-equality",
    reportedLawIds: ["APEX-AUDIT-TRUTH-001-V1"],
    findings: isExpectedCall ? [] : [],
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
  "scripts/audit/shared/aliased-text-helper.ts": `
export const hasAliasedText = (text: string) => {
  const alias = text;
  return alias.includes("alpha");
};
`,
  "scripts/audit/shared/assigned-text-helper.ts": `
export const hasAssignedText = (text: string) => {
  let alias = ""; alias = text;
  return alias.includes("alpha");
};
`,
  "scripts/audit/domains/aliased-text/inspector.ts": `
import { hasAliasedText } from "../../shared/aliased-text-helper.js";
export const inspectDomain = async (context: { project: { getSourceFiles(): Array<{ getFullText(): string }> } }) => {
  const passed = hasAliasedText(context.project.getSourceFiles()[0]?.getFullText() ?? "");
  return { capabilityDomain: "aliased-text", reportedLawIds: ["APEX-AUDIT-TRUTH-001-V1"], findings: passed ? [] : [], inspectedFiles: [] };
};
`,
  "scripts/audit/domains/assigned-text/inspector.ts": `
import { hasAssignedText } from "../../shared/assigned-text-helper.js";
export const inspectDomain = async (context: { project: { getSourceFiles(): Array<{ getFullText(): string }> } }) => {
  const passed = hasAssignedText(context.project.getSourceFiles()[0]?.getFullText() ?? "");
  return { capabilityDomain: "assigned-text", reportedLawIds: ["APEX-AUDIT-TRUTH-001-V1"], findings: passed ? [] : [], inspectedFiles: [] };
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

const indexOfJudgmentCase = createRuntimeProject("indexof-source-text", {
  "scripts/audit/domains/source-text/inspector.ts": `
export const inspectDomain = async (context: { project: { getSourceFiles(): Array<{ getFullText(): string }> } }) => {
  const source = context.project.getSourceFiles()[0];
  const text = source?.getFullText() ?? "";
  const findings = text.indexOf("required-structure") >= 0 ? [] : [{
    checkId: "source-text/indexof",
    lawId: "APEX-AUDIT-TRUTH-001-V1",
    clauseId: "source-text-indexof",
    message: "raw source judgment",
    severity: "fatal" as const,
  }];
  return { capabilityDomain: "source-text", reportedLawIds: ["APEX-AUDIT-TRUTH-001-V1"], findings, inspectedFiles: [] };
};
`,
});
const indexOfJudgmentOutput = await inspectDomain(createContext(indexOfJudgmentCase.project, [
  {
    blueprintRefs: [],
    capabilityDomain: "source-text",
    bindings: createBindings(LAW_IDS, `${indexOfJudgmentCase.runtimeRepoPath}/scripts/audit/domains/source-text/inspector.ts`),
    executionGroup: "meta",
    lawIds: LAW_IDS,
    manifestPath: `${indexOfJudgmentCase.runtimeRepoPath}/scripts/audit/domains/source-text/manifest.json`,
    ownerInspectorPath: `${indexOfJudgmentCase.runtimeRepoPath}/scripts/audit/domains/source-text/inspector.ts`,
  },
]));
assert.equal(
  hasFinding(indexOfJudgmentOutput.findings, {
    checkId: "audit-truth/source-text-judgment",
    fileIncludes: "/scripts/audit/domains/source-text/inspector.ts",
  }),
  true,
  "audit-truth should fail getFullText flowing into indexOf structural judgment.",
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
    fileIncludes: "/scripts/audit/domains/type-text/inspector.ts",
  }),
  true,
  "audit-truth should fail Type.getText() values used for structural string judgment.",
);
assert.equal(
  hasFinding(projectUsageOutput.findings, {
    checkId: "audit-truth/source-text-judgment",
    fileIncludes: "/scripts/audit/domains/audit-system/text-equality-inspector.ts",
  }),
  true,
  "audit-truth should fail ts-morph getText() values used in equality-based structural judgment.",
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
    checkId: "audit-truth/source-text-judgment",
    fileIncludes: "/scripts/audit/domains/aliased-text/inspector.ts",
  }),
  true,
  "audit-truth should follow helper parameters through local aliases before text judgment.",
);
assert.equal(
  hasFinding(projectUsageOutput.findings, { checkId: "audit-truth/source-text-judgment",
    fileIncludes: "/scripts/audit/domains/assigned-text/inspector.ts" }),
  true,
  "audit-truth should follow helper parameters through assignment aliases before text judgment.",
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

const receiptPlan = {
  blueprintRefs: [],
  capabilityDomain: "receipt-fixture",
  bindings: [
    {
      lawId: "APEX-AUDIT-001-V1",
      clauseId: "receipt-fixture-first",
      evidenceMode: "static" as const,
      checkIds: ["receipt-fixture/owner-assertion-set"],
      sourceEvidence: [{ filePath: "scripts/audit/domains/receipt-fixture/inspector.ts", symbolName: "inspectDomain" }],
    },
    {
      lawId: "APEX-AUDIT-002-V1",
      clauseId: "receipt-fixture-second",
      evidenceMode: "static" as const,
      checkIds: ["receipt-fixture/owner-assertion-set"],
      sourceEvidence: [{ filePath: "scripts/audit/domains/receipt-fixture/inspector.ts", symbolName: "inspectDomain" }],
    },
    {
      lawId: "APEX-AUDIT-003-V1",
      clauseId: "receipt-fixture-real-chrome",
      evidenceMode: "real-chrome" as const,
      checkIds: ["receipt-fixture/owner-assertion-set"],
      sourceEvidence: [{ filePath: "scripts/audit/domains/receipt-fixture/inspector.ts", symbolName: "inspectDomain" }],
    },
  ],
  executionGroup: "meta" as const,
  lawIds: ["APEX-AUDIT-001-V1", "APEX-AUDIT-002-V1", "APEX-AUDIT-003-V1"],
  manifestPath: "scripts/audit/domains/receipt-fixture/manifest.json",
  ownerInspectorPath: "scripts/audit/domains/receipt-fixture/inspector.ts",
};

const goodSession = createInspectorCheckSession(receiptPlan);
await goodSession.checks.runAll(() => ({
  evidenceRefs: ["src/alpha.ts", "src/beta.ts"],
  findings: [],
}));
const goodSessionOutput = goodSession.checks.output();
assert.equal(goodSession.isAuthenticOutput(goodSessionOutput), true, "runner-created session output must authenticate.");
assert.equal(goodSessionOutput.checkRuns.length, 1, "one owner assertion set must create exactly one physical receipt.");
assert.equal(goodSessionOutput.executedChecks.length, 2, "one owner assertion set may map to multiple declared law clauses.");
const assertionSetMappings = goodSessionOutput.executedChecks.filter((receipt) => receipt.checkId === "receipt-fixture/owner-assertion-set");
assert.equal(assertionSetMappings.length, 2, "the owner assertion set must preserve both declared clause mappings.");
assert.equal(assertionSetMappings[0]?.checkRunId, assertionSetMappings[1]?.checkRunId, "all clause mappings must reference the one physical owner execution.");
assert.equal(
  goodSessionOutput.executedChecks.some((mapping) => mapping.clauseId === "receipt-fixture-real-chrome"),
  false,
  "ordinary owner receipts must never claim a real-Chrome clause was executed.",
);

const missingSession = createInspectorCheckSession(receiptPlan);
assert.throws(
  () => missingSession.checks.output(),
  (error: unknown) => error instanceof Error && error.message.includes("omitted physical check"),
  "session output must fail when a declared physical check never ran.",
);

const duplicateSession = createInspectorCheckSession(receiptPlan);
await duplicateSession.checks.runAll(() => ({ evidenceRefs: ["src/alpha.ts"], findings: [] }));
await assert.rejects(
  duplicateSession.checks.runAll(() => ({ evidenceRefs: ["src/alpha.ts"], findings: [] })),
  (error: unknown) => error instanceof Error && error.message.includes("duplicate owner evaluation"),
  "session must reject duplicate owner evaluation execution.",
);

const emptyEvidenceSession = createInspectorCheckSession({
  ...receiptPlan,
  bindings: [receiptPlan.bindings[0]!],
  lawIds: ["APEX-AUDIT-001-V1"],
});
await emptyEvidenceSession.checks.runAll(() => ({ evidenceRefs: [], findings: [] }));
const emptyEvidenceOutput = emptyEvidenceSession.checks.output();
assert.equal(emptyEvidenceOutput.checkRuns[0]?.status, "FAIL", "a check with no evidence ref must receive a FAIL receipt.");
assert.equal(emptyEvidenceOutput.findings.length, 1, "missing check evidence must create a machine-blocking finding.");

const throwingSession = createInspectorCheckSession({
  ...receiptPlan,
  bindings: [receiptPlan.bindings[0]!],
  lawIds: ["APEX-AUDIT-001-V1"],
});
await throwingSession.checks.runAll(() => {
  throw new Error("fixture callback failure");
});
const throwingOutput = throwingSession.checks.output();
assert.equal(throwingOutput.checkRuns[0]?.status, "FAIL", "a throwing check callback must receive a FAIL receipt.");

const secondSession = createInspectorCheckSession(receiptPlan);
assert.equal(secondSession.isAuthenticOutput(goodSessionOutput), false, "a receipt output from another run must not authenticate.");
assert.equal(goodSession.isAuthenticOutput({ ...goodSessionOutput }), false, "a copied or spread receipt output must not authenticate.");


rmSync(RUNTIME_ROOT, { force: true, recursive: true });
console.log("audit-truth-coverage-acceptance-ok");
