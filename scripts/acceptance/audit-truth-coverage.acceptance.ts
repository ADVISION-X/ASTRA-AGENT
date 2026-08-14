import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { inspectDomain } from "../audit/domains/audit-truth/inspector.js";
import { LAW_IDS, RUNTIME_ROOT, createBindings, createContext, createRuntimeProject, hasFinding } from "./audit-truth-coverage-fixture.js";
import { runAuditTruthOrphanPlanAttack } from "./audit-truth-plan-coverage.attacks.js";
import { runAuditTruthReceiptContractAcceptance } from "./audit-truth-receipt-contract.acceptance-support.js";
import { runAuditTruthSourceTextAttacks } from "./audit-truth-source-text.attacks.js";


const projectUsageCase = createRuntimeProject("project-usage", {
  "scripts/audit/ci-full.ts": `
import { runGeneratedPlanFiltered } from "./core/run-generated-plan.js";
export const runCi = () => runGeneratedPlanFiltered({ capabilityDomains: ["audit-truth"] });
`,
  "scripts/audit/alternate-runner.ts": `
import { runGeneratedPlan } from "./core/run-generated-plan.js";
export const runAlternateAudit = () => runGeneratedPlan();
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
  "scripts/audit/domains/beta-alias/inspector.ts": `
export const inspectDomain = async (context: { project: { getSourceFiles(): unknown[] } }) => {
  const project = context.project;
  const consume = (input: { project: { getSourceFiles(): unknown[] } }) => input.project.getSourceFiles();
  return {
    capabilityDomain: "beta-alias",
    reportedLawIds: ["APEX-AUDIT-TRUTH-001-V1"],
    findings: consume({ project }).length > 0 ? [] : [],
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
  const isController = controllerTypeName.includes("BrowserTargetSession");
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
  "scripts/audit/domains/code-purity/text-equality-helper.ts": `
export const hasExpectedConstructor = (expression: { getText(): string }): boolean =>
  expression.getText() === "RegExp";
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
export const readRepoObject = (repoPath: string): { text: string } => ({ text: readFileSync(repoPath, "utf8") });
export const readRepoArray = (repoPath: string): [string] => [readFileSync(repoPath, "utf8")];
export const readRepoPushedArray = (repoPath: string): string[] => {
  const values: string[] = [];
  values.push(readFileSync(repoPath, "utf8"));
  return values;
};
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
  "scripts/audit/domains/object-return-laundering/inspector.ts": `
import { readRepoObject, requireTokens } from "../../shared/raw-file-helper.js";

export const inspectDomain = async (context: { project: { getSourceFiles(): unknown[] } }) => {
  void context.project.getSourceFiles().length;
  const sourceBundle = readRepoObject("src/runtime.ts");
  const passed = requireTokens(sourceBundle.text, ["runRuntime"]);
  return { capabilityDomain: "object-return-laundering", reportedLawIds: ["APEX-AUDIT-TRUTH-001-V1"], findings: passed ? [] : [], inspectedFiles: [] };
};
`,
  "scripts/audit/domains/array-return-laundering/inspector.ts": `
import { readRepoArray, readRepoPushedArray, requireTokens } from "../../shared/raw-file-helper.js";

export const inspectDomain = async (context: { project: { getSourceFiles(): unknown[] } }) => {
  void context.project.getSourceFiles().length;
  const [runtimeText] = readRepoArray("src/runtime.ts");
  const [pushedText] = readRepoPushedArray("src/runtime.ts");
  const passed = requireTokens(runtimeText, ["runRuntime"])
    && requireTokens(pushedText, ["runRuntime"]);
  return { capabilityDomain: "array-return-laundering", reportedLawIds: ["APEX-AUDIT-TRUTH-001-V1"], findings: passed ? [] : [], inspectedFiles: [] };
};
`,
  "scripts/audit/domains/audit-truth/meta-quality-regexp.ts": `
const ConstructorAlias = RegExp;
const pattern = new ConstructorAlias("alpha");
void pattern;
`,
  "scripts/acceptance/audit-truth-coverage.acceptance.ts": `
const method = "match";
const text = "alpha";
const result = text[method]("alpha");

const project = null as unknown as { getSourceFiles(): Array<{ getFullText(): string }> };
const sourceFile = project.getSourceFiles()[0];
const fullText = sourceFile?.getFullText() ?? "";
const hasAlpha = fullText.includes("alpha");
const callDynamic = (dynamicMethod: string) => "alpha"[dynamicMethod]("alpha");

void result;
void hasAlpha;
void callDynamic;
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

const duplicateAlphaPlanEntry = {
  blueprintRefs: [],
  capabilityDomain: "alpha",
  bindings: createBindings(LAW_IDS, `${projectUsageCase.runtimeRepoPath}/scripts/audit/domains/alpha/inspector.ts`),
  executionGroup: "meta" as const,
  lawIds: LAW_IDS,
  manifestPath: `${projectUsageCase.runtimeRepoPath}/scripts/audit/domains/alpha/manifest.json`,
  ownerInspectorPath: `${projectUsageCase.runtimeRepoPath}/scripts/audit/domains/alpha/inspector.ts`,
};
const duplicatePlanOutput = await inspectDomain(createContext(
  projectUsageCase.project,
  [duplicateAlphaPlanEntry, { ...duplicateAlphaPlanEntry }],
));
assert.equal(
  hasFinding(duplicatePlanOutput.findings, {
    checkId: "audit-truth/duplicate-generated-plan-entry",
    fileIncludes: "/scripts/audit/domains/alpha/inspector.ts",
  }),
  true,
  "audit-truth must retain generated-plan multiplicity and fail duplicate owner entries.",
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
  projectUsageOutput.findings.some((finding) =>
    finding.checkId === "audit-truth/inspector-project-usage"
    && finding.lawId === "APEX-AUDIT-TRUTH-001-V1"),
  true,
  "owner-wide AST enforcement findings must retain APEX-AUDIT-TRUTH-001-V1 authority.",
);
assert.equal(
  hasFinding(projectUsageOutput.findings, {
    checkId: "audit-truth/inspector-project-usage",
    fileIncludes: "/scripts/audit/domains/beta/inspector.ts",
  }),
  false,
  "a consumed chained context.project call must qualify as project-backed AST enforcement.",
);
assert.equal(
  hasFinding(projectUsageOutput.findings, {
    checkId: "audit-truth/inspector-project-usage",
    fileIncludes: "/scripts/audit/domains/beta-alias/inspector.ts",
  }),
  false,
  "a consumed context.project alias passed through a shorthand property must qualify as project-backed AST enforcement.",
);

await runAuditTruthSourceTextAttacks();
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
  projectUsageOutput.findings.some((finding) =>
    finding.checkId === "audit-truth/source-regex-judgment"
    && finding.lawId === "APEX-AUDIT-TRUTH-001-V1"),
  true,
  "owner-wide regex enforcement findings must retain APEX-AUDIT-TRUTH-001-V1 authority.",
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
    fileIncludes: "/scripts/audit/domains/code-purity/text-equality-helper.ts",
  }),
  true,
  "audit-truth should fail equality-based source-text judgments in every audit owner directory.",
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
    fileIncludes: "/scripts/audit/domains/object-return-laundering/inspector.ts",
  }),
  true,
  "audit-truth should fail source text laundered through a returned object.",
);
assert.equal(
  hasFinding(projectUsageOutput.findings, {
    checkId: "audit-truth/source-text-judgment",
    fileIncludes: "/scripts/audit/domains/array-return-laundering/inspector.ts",
  }),
  true,
  "audit-truth should fail source text laundered through a returned array.",
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
    fileIncludes: "/scripts/acceptance/audit-truth-coverage.acceptance.ts",
  }),
  true,
  "audit-truth should fail dynamic banned-method escapes inside audit meta-quality proof scripts.",
);
assert.equal(
  hasFinding(projectUsageOutput.findings, {
    checkId: "audit-truth/meta-quality-dynamic-method-escape",
    fileIncludes: "/scripts/acceptance/audit-truth-coverage.acceptance.ts",
  }),
  true,
  "audit-truth should fail closed when a dynamic string method cannot be resolved.",
);
assert.equal(
  hasFinding(projectUsageOutput.findings, {
    checkId: "audit-truth/source-text-judgment",
    fileIncludes: "/scripts/acceptance/audit-truth-coverage.acceptance.ts",
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

await runAuditTruthOrphanPlanAttack();

assert.equal(
  hasFinding(projectUsageOutput.findings, {
    checkId: "audit-truth/ci-owner-special-case",
    fileIncludes: "/scripts/audit/ci-full.ts",
  }),
  true,
  "audit-truth should fail CI orchestration that hardcodes a filtered owner run.",
);
assert.equal(
  hasFinding(projectUsageOutput.findings, {
    checkId: "audit-truth/ci-owner-special-case",
    fileIncludes: "/scripts/audit/alternate-runner.ts",
  }),
  true,
  "audit-truth should fail a parallel generated-plan runner at any audit path.",
);

await runAuditTruthReceiptContractAcceptance();


rmSync(RUNTIME_ROOT, { force: true, recursive: true });
console.log("audit-truth-coverage-acceptance-ok");
