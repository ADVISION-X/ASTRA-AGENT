import assert from "node:assert/strict";

import { inspectDomain } from "../audit/domains/audit-truth/inspector.js";
import { LAW_IDS, createBindings, createContext, createRuntimeProject, hasFinding } from "./audit-truth-coverage-fixture.js";

const inspectAttack = async (caseName: string, files: Record<string, string>) => {
  const attack = createRuntimeProject(caseName, files);
  const inspectorPath = `${attack.runtimeRepoPath}/scripts/audit/domains/source-text/inspector.ts`;
  return inspectDomain(createContext(attack.project, [{
    blueprintRefs: [],
    capabilityDomain: "source-text",
    bindings: createBindings(LAW_IDS, inspectorPath),
    executionGroup: "meta",
    lawIds: LAW_IDS,
    manifestPath: `${attack.runtimeRepoPath}/scripts/audit/domains/source-text/manifest.json`,
    ownerInspectorPath: inspectorPath,
  }]));
};

export const runAuditTruthSourceTextAttacks = async (): Promise<void> => {
  const indexOfOutput = await inspectAttack("indexof-source-text", {
    "scripts/audit/domains/source-text/inspector.ts": `
export const inspectDomain = async (context: { project: { getSourceFiles(): Array<{ getFullText(): string }> } }) => {
  const text = context.project.getSourceFiles()[0]?.getFullText() ?? "";
  const findings = text.indexOf("required-structure") >= 0 ? [] : [];
  return { capabilityDomain: "source-text", reportedLawIds: ["APEX-AUDIT-TRUTH-001-V1"], findings, inspectedFiles: [] };
};
`,
  });
  assert.equal(hasFinding(indexOfOutput.findings, {
    checkId: "audit-truth/source-text-judgment",
    fileIncludes: "/scripts/audit/domains/source-text/inspector.ts",
  }), true, "audit-truth must reject getFullText flowing into indexOf judgment.");

  const wrapperOutput = await inspectAttack("wrapper-slice-source-text", {
    "scripts/audit/shared/token-search.ts": `
export const containsAny = (text: string, tokens: readonly string[]): boolean =>
  tokens.some((token) => text.includes(token));
export const hasSignal = (text: string): boolean => containsAny(text, ["required-structure"]);
`,
    "scripts/audit/domains/source-text/inspector.ts": `
import { hasSignal } from "../../shared/token-search.js";
export const inspectDomain = async (context: { project: { getSourceFiles(): Array<{ getText(): string }> } }) => {
  const nearbyText = context.project.getSourceFiles()[0]?.getText().slice(0, 900) ?? "";
  const findings = hasSignal(nearbyText) ? [] : [];
  return { capabilityDomain: "source-text", reportedLawIds: ["APEX-AUDIT-TRUTH-001-V1"], findings, inspectedFiles: [] };
};
`,
  });
  assert.equal(hasFinding(wrapperOutput.findings, {
    checkId: "audit-truth/source-text-judgment",
    fileIncludes: "/scripts/audit/domains/source-text/inspector.ts",
  }), true, "audit-truth must reject sliced source text laundered through transitive wrappers.");
};
