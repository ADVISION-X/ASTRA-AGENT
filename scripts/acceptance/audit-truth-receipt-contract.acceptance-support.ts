import assert from "node:assert/strict";

import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import { auditManifestSchema } from "../audit/shared/manifest-contracts.js";

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

export const runAuditTruthReceiptContractAcceptance = async (): Promise<void> => {
  assert.equal(auditManifestSchema.safeParse({
    capabilityDomain: "legacy",
    ownerInspectorPath: "scripts/audit/domains/legacy/inspector.ts",
    executionGroup: "domain",
    coverage: { mode: "domain-wide", clauseIds: ["primary"] },
  }).success, false, "manifest contract must reject domain-wide primary placeholder coverage.");

  const goodSession = createInspectorCheckSession(receiptPlan, "acceptance-run:receipt-good");
  await goodSession.checks.runAll(() => ({ evidenceRefs: ["src/alpha.ts", "src/beta.ts"], findings: [] }));
  const goodSessionOutput = goodSession.checks.output();
  assert.equal(goodSession.isAuthenticOutput(goodSessionOutput), true);
  assert.equal(goodSessionOutput.checkRuns[0]?.runId, "acceptance-run:receipt-good");
  assert.equal(goodSessionOutput.checkRuns.length, 1);
  assert.equal(goodSessionOutput.executedChecks.length, 2);
  const mappings = goodSessionOutput.executedChecks.filter((receipt) => receipt.checkId === "receipt-fixture/owner-assertion-set");
  assert.equal(mappings.length, 2);
  assert.equal(mappings[0]?.checkRunId, mappings[1]?.checkRunId);
  assert.equal(goodSessionOutput.executedChecks.some((mapping) => mapping.clauseId === "receipt-fixture-real-chrome"), false);

  const missingSession = createInspectorCheckSession(receiptPlan, "acceptance-run:receipt-missing");
  assert.throws(() => missingSession.checks.output(), /omitted physical check/u);
  const duplicateSession = createInspectorCheckSession(receiptPlan, "acceptance-run:receipt-duplicate");
  await duplicateSession.checks.runAll(() => ({ evidenceRefs: ["src/alpha.ts"], findings: [] }));
  await assert.rejects(duplicateSession.checks.runAll(() => ({ evidenceRefs: ["src/alpha.ts"], findings: [] })), /duplicate physical check/u);

  const singleBindingPlan = { ...receiptPlan, bindings: [receiptPlan.bindings[0]!], lawIds: ["APEX-AUDIT-001-V1"] };
  const emptyEvidenceSession = createInspectorCheckSession(singleBindingPlan, "acceptance-run:receipt-empty-evidence");
  await emptyEvidenceSession.checks.runAll(() => ({ evidenceRefs: [], findings: [] }));
  const emptyEvidenceOutput = emptyEvidenceSession.checks.output();
  assert.equal(emptyEvidenceOutput.checkRuns[0]?.status, "FAIL");
  assert.equal(emptyEvidenceOutput.findings.length, 1);

  const throwingSession = createInspectorCheckSession(singleBindingPlan, "acceptance-run:receipt-throwing");
  await throwingSession.checks.runAll(() => { throw new Error("fixture callback failure"); });
  assert.equal(throwingSession.checks.output().checkRuns[0]?.status, "FAIL");
  const secondSession = createInspectorCheckSession(receiptPlan, "acceptance-run:receipt-second");
  assert.equal(secondSession.isAuthenticOutput(goodSessionOutput), false);
  assert.equal(goodSession.isAuthenticOutput({ ...goodSessionOutput }), false);
};
