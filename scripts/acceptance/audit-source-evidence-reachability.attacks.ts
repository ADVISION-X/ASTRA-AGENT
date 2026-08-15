import assert from "node:assert/strict";
import { Project, SyntaxKind } from "ts-morph";

import { appendDomainArtifactsFromIndexes } from "../audit/build/compose-artifact-domain-artifacts.js";
import { loadGeneratedAuditPlan } from "../audit/core/load-audit-plan.js";
import { inspectPhysicalCheckReceiptContract } from "../audit/domains/audit-system/physical-check-receipt-inspector.js";
import { inspectPrimaryEvidenceContract } from "../audit/domains/audit-system/primary-evidence-inspector.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import type { InspectorContext } from "../audit/shared/inspector-contracts.js";
import type { LawSource } from "../audit/shared/law-contracts.js";
import type { ManifestSource } from "../audit/shared/manifest-contracts.js";
import { resolveFromRepo } from "../audit/shared/paths.js";

const attackProject = new Project({ tsConfigFilePath: resolveFromRepo("tsconfig.json") });

const buildContext = (project: Project = attackProject): InspectorContext => {
  const generatedPlan = loadGeneratedAuditPlan();
  const planEntry = generatedPlan.find((entry) => entry.capabilityDomain === "audit-system");
  if (!planEntry) throw new Error("audit-system plan entry is missing.");
  return {
    project,
    planEntry,
    generatedPlan,
    completedReports: {},
    checks: createInspectorCheckSession(planEntry, "acceptance-run:audit-source-evidence-reachability").checks,
  };
};

const runSourceEvidenceReachabilityAttack = (
  label: string,
  evidence: { filePath: string; symbolName: string },
  extraSource: string,
  ownerBody = "registerDecoy(() => evidence());",
): void => {
  const domain = `source-evidence-${label}`;
  const lawId = `APEX-AUDIT-SOURCE-EVIDENCE-${label.toUpperCase()}-V1`;
  const clauseId = `apex-audit-source-evidence-${label}-requirement`;
  const inspectorPath = `scripts/audit/shared/${domain}.fixture.ts`;
  const inspector = attackProject.createSourceFile(resolveFromRepo(inspectorPath), `
${extraSource}
export const inspectDomain = async (context: {
  checks: { runAll(body: () => Promise<{ findings: unknown[]; evidenceRefs: string[] }>): Promise<unknown>; output(): unknown };
  planEntry: { ownerInspectorPath: string };
}) => {
  await context.checks.runAll(async () => {
    ${ownerBody}
    return { findings: [], evidenceRefs: [context.planEntry.ownerInspectorPath] };
  });
  return context.checks.output();
};
`, { overwrite: true });
  const law: LawSource = {
    lawId,
    status: "active",
    tier: "P0",
    capabilityDomain: domain,
    enforcementMode: "static",
    evidenceMode: "static",
    summary: "source evidence reachability attack fixture",
    clauses: [{ clauseId, statement: "fixture", evidenceMode: "static", ownerDomain: domain }],
    filePath: `.github/instructions/agent-rules/modules/${domain}.instructions.md`,
    blockIndex: 0,
  };
  const manifest: ManifestSource = {
    capabilityDomain: domain,
    ownerInspectorPath: inspectorPath,
    executionGroup: "meta",
    coverage: { mode: "explicit", bindings: [{
      lawId,
      clauseId,
      checkIds: [`${domain}/owner-assertion-set`],
      sourceEvidence: [evidence],
    }] },
    manifestPath: `scripts/audit/domains/${domain}/manifest.json`,
  };
  const outputs: Parameters<typeof appendDomainArtifactsFromIndexes>[0] = {
    conflicts: [], matrixRows: [], planEntries: [], staticCoverage: [],
  };
  appendDomainArtifactsFromIndexes(
    outputs,
    { lawsById: new Map([[lawId, [law]]]), manifestsByDomain: new Map([[domain, [manifest]]]) },
    attackProject,
    [law],
  );
  assert.equal(outputs.conflicts.some((conflict) => conflict.kind === "unreachable-source-evidence"), true,
    `${label} source evidence laundering must fail closed.`);
  inspector.forget();
};

export const runSourceEvidenceReachabilityAttacks = (): void => {
  runSourceEvidenceReachabilityAttack(
    "global-builder",
    { filePath: "scripts/audit/build-audit-artifacts.ts", symbolName: "buildAuditArtifacts" },
    "const registerDecoy = (_callback: () => void): void => {};\nconst evidence = (): void => {};",
  );
  runSourceEvidenceReachabilityAttack(
    "uncalled-callback",
    { filePath: "scripts/audit/shared/source-evidence-uncalled-callback.fixture.ts", symbolName: "evidence" },
    "const registerDecoy = (_callback: () => void): void => {};\nexport const evidence = (): void => {};",
  );
  runSourceEvidenceReachabilityAttack(
    "discarded-result",
    { filePath: "scripts/audit/shared/source-evidence-discarded-result.fixture.ts", symbolName: "evidence" },
    `import { createFinding } from "./finding-utils.js";
const registerDecoy = (_callback: () => void): void => {};
export const evidence = () => [createFinding({ checkId: "fixture/check", lawId: "APEX-AUDIT-SOURCE-EVIDENCE-DISCARDED-RESULT-V1", message: "fixture" })];`,
    "evidence();",
  );
};

const composePrimaryEvidenceAttack = (primaryEvidence?: { engine: "ast"; sourceEvidenceIndex: number }) => {
  const domain = "primary-evidence-attack";
  const lawId = "APEX-AUDIT-PRIMARY-EVIDENCE-ATTACK-V1";
  const clauseId = "apex-audit-primary-evidence-attack-requirement";
  const inspectorPath = "scripts/audit/shared/primary-evidence-attack.fixture.ts";
  const inspector = attackProject.createSourceFile(resolveFromRepo(inspectorPath), `
export const inspectEvidence = (): unknown[] => [];
export const inspectDomain = async (context: {
  checks: { runAll(body: () => Promise<{ findings: unknown[]; evidenceRefs: string[] }>): Promise<unknown>; output(): unknown };
  planEntry: { ownerInspectorPath: string };
}) => {
  await context.checks.runAll(async () => ({ findings: inspectEvidence(), evidenceRefs: [context.planEntry.ownerInspectorPath] }));
  return context.checks.output();
};
`, { overwrite: true });
  const law: LawSource = {
    lawId,
    status: "active",
    tier: "P0",
    capabilityDomain: domain,
    enforcementMode: "meta",
    evidenceMode: "hybrid",
    summary: "primary evidence attack fixture",
    clauses: [{ clauseId, statement: "fixture", evidenceMode: "static", ownerDomain: domain }],
    filePath: `.github/instructions/agent-rules/modules/${domain}.instructions.md`,
    blockIndex: 0,
  };
  const manifest: ManifestSource = {
    capabilityDomain: domain,
    ownerInspectorPath: inspectorPath,
    executionGroup: "meta",
    coverage: { mode: "explicit", bindings: [{
      lawId,
      clauseId,
      checkIds: [`${domain}/owner-assertion-set`],
      sourceEvidence: [{ filePath: inspectorPath, symbolName: "inspectEvidence" }],
      ...(primaryEvidence ? { primaryEvidence } : {}),
    }] },
    manifestPath: `scripts/audit/domains/${domain}/manifest.json`,
  };
  const outputs: Parameters<typeof appendDomainArtifactsFromIndexes>[0] = {
    conflicts: [], matrixRows: [], planEntries: [], staticCoverage: [],
  };
  appendDomainArtifactsFromIndexes(
    outputs,
    { lawsById: new Map([[lawId, [law]]]), manifestsByDomain: new Map([[domain, [manifest]]]) },
    attackProject,
    [law],
  );
  inspector.forget();
  return outputs.conflicts;
};

export const runPrimaryEvidenceDeclarationAttacks = (): void => {
  assert.equal(composePrimaryEvidenceAttack()
    .some((conflict) => conflict.kind === "missing-primary-evidence"), true,
  "hybrid enforcement without a declared primary evidence path must fail closed.");
  assert.equal(composePrimaryEvidenceAttack({ engine: "ast", sourceEvidenceIndex: 1 })
    .some((conflict) => conflict.kind === "invalid-primary-evidence"), true,
  "hybrid enforcement with an out-of-range primary evidence path must fail closed.");

  const baseline = inspectPrimaryEvidenceContract(buildContext(), "APEX-AUDIT-006-V1", new Set());
  assert.equal(baseline.length, 0, "current hybrid bindings must execute their declared primary engines.");

  for (const attack of [
    ["scripts/audit/domains/audit-system/primary-evidence-inspector.ts", "inspectPrimaryEvidenceContract", "APEX-AUDIT-006-V1"],
    ["scripts/audit/domains/audit-system/inspector.ts", "inspectLawParserContract", "APEX-AUDIT-002-V1"],
    ["scripts/audit/domains/audit-system/inspector.ts", "inspectBlueprintContract", "APEX-AUDIT-007-V1"],
  ] as const) {
    const [filePath, symbolName, lawId] = attack;
    const project = new Project({ tsConfigFilePath: resolveFromRepo("tsconfig.json") });
    project.getSourceFileOrThrow(resolveFromRepo(filePath))
      .getVariableDeclarationOrThrow(symbolName)
      .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction)
      .setBodyText(`return [createFinding({ checkId: "fixture/engine", lawId: "${lawId}", message: "fixture" })];`);
    const findings = inspectPrimaryEvidenceContract(buildContext(project), "APEX-AUDIT-006-V1", new Set());
    assert.equal(findings.some((finding) => finding.message.includes(`${lawId}/`)
      && finding.message.includes("does not execute that engine")), true,
    `${lawId} must reject source evidence that does not execute its declared primary engine.`);
  }
};

export const runOwnerFilesystemWriterEscapeAttacks = (): void => {
  const fixturePath = resolveFromRepo("scripts/audit/domains/writer-escape/namespace.fixture.ts");
  const helperPath = resolveFromRepo("scripts/audit/shared/writer-escape-helper.fixture.ts");
  const helper = attackProject.createSourceFile(helperPath, `
import { writeFileSync } from "node:fs";
export const persistViaHelper = (): void => writeFileSync("artifact-3.txt", "forbidden");
`, { overwrite: true });
  const fixture = attackProject.createSourceFile(fixturePath, `
import * as fs from "node:fs";
import { writeFileSync as persist } from "node:fs";
import { persistViaHelper } from "../../shared/writer-escape-helper.fixture.js";
const method = "writeFileSync";
const aliasedWrite = fs[method];
aliasedWrite("artifact.txt", "forbidden");
persist("artifact-2.txt", "forbidden");
persistViaHelper();
`, { overwrite: true });
  const result = inspectPhysicalCheckReceiptContract(buildContext(), {
    binaryVerdict: "APEX-AUDIT-010-V1",
    deletion: "APEX-AUDIT-009-V1",
    enforcementTruth: "APEX-AUDIT-006-V1",
    runner: "APEX-AUDIT-005-V1",
  });
  assert.equal(result.findings.some((finding) => finding.checkId === "audit-system/runner-law-truth"
    && finding.filePath === fixturePath && finding.message.includes("read-only")), true,
  "owner filesystem writer governance must symbol-resolve namespace, computed and aliased node:fs mutations.");
  fixture.forget();
  helper.forget();
};
