import assert from "node:assert/strict";
import test from "node:test";

import { buildRegistry, type Law } from "../../scripts/audit/governance-authority.js";
import { GovernanceError } from "../../scripts/audit/governance-runtime.js";
import {
  buildQualityReport,
  clausesForEvidenceMode,
  clausesForLaw,
  deferredModes,
  requiredModes,
  type LawExecutionResult,
} from "../../scripts/audit/shared/quality-contract.js";
import { computeTargetPaths, dynamicScriptFor } from "../../scripts/audit/shared/quality-runner.js";

const fixtureLaw = (): Law => ({
  schemaVersion: 2,
  lawId: "LAW-FIXTURE-001-V1",
  supersedesLawId: null,
  status: "active",
  tier: "P0",
  capabilityDomain: "fixture",
  enforcementMode: "composite",
  evidenceModes: ["static.ast", "exam.golden", "dynamic.service"],
  summary: "必须保持 fixture。",
  appliesTo: ["src/fixture/**"],
  excludes: [],
  forbidden: ["不得发生 fixture bypass。"],
  dependsOnLawIds: [],
  source: { path: ".github/instructions/agent-rules/功能法案.md", lineStart: 1, lineEnd: 2 },
  contractRefs: [],
});

const resultFor = (law: Law): LawExecutionResult => {
  const required = requiredModes(law, "READY");
  return {
    lawId: law.lawId,
    assertions: required.map((mode) => ({
      clauses: clausesForEvidenceMode(law, required, mode),
      evidenceMode: mode,
      passed: true,
      refs: [mode.startsWith("exam.") ? "exam:fixture#seed%3Dfixed" : "ast:src/fixture/index.ts#fixture"],
    })),
    findings: [],
  };
};

test("READY requires static and exam evidence while deferring only dynamic evidence", () => {
  const law = fixtureLaw();
  assert.deepEqual(requiredModes(law, "READY"), ["exam.golden", "static.ast"]);
  assert.deepEqual(deferredModes(law, "READY"), ["dynamic.service"]);
  assert.deepEqual(requiredModes(law, "RELEASE"), ["dynamic.service", "exam.golden", "static.ast"]);
  assert.deepEqual(deferredModes(law, "RELEASE"), []);
});

test("evidence modes cover the exact clause denominator without blanket duplication", () => {
  const law = fixtureLaw();
  const required = requiredModes(law, "READY");
  const coverage = [...new Set(required.flatMap((mode) => clausesForEvidenceMode(law, required, mode)))].sort();
  assert.deepEqual(coverage, clausesForLaw(law));
  assert.notDeepEqual(
    clausesForEvidenceMode(law, required, required[0]!),
    clausesForEvidenceMode(law, required, required[1]!),
  );
  assert.deepEqual(clausesForEvidenceMode(law, required, "static.ast"), clausesForLaw(law));
  assert.deepEqual(clausesForEvidenceMode(law, required, "exam.golden"), ["summary"]);
});

test("quality report rejects missing evidence modes and unsupported PASS claims", () => {
  const law = fixtureLaw();
  const missingMode = resultFor(law);
  missingMode.assertions.pop();
  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [missingMode] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "EVIDENCE_MODE_DENOMINATOR_MISMATCH",
  );

  const falseWithoutFinding = resultFor(law);
  falseWithoutFinding.assertions[0]!.passed = false;
  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [falseWithoutFinding] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "FAILED_ASSERTION_WITHOUT_FINDING",
  );
});

test("quality report rejects wrong evidence types, duplicate clause claims, and invalid candidates", () => {
  const law = fixtureLaw();
  const wrongKind = resultFor(law);
  wrongKind.assertions.find((assertion) => assertion.evidenceMode === "static.ast")!.refs = ["file:src/fixture/index.ts#fixture"];
  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [wrongKind] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "QUALITY_ASSERTION_INVALID",
  );

  const duplicate = resultFor(law);
  duplicate.assertions.push({ ...duplicate.assertions[0]!, refs: [...duplicate.assertions[0]!.refs] });
  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [duplicate] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "QUALITY_ASSERTION_DUPLICATE",
  );

  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "not-a-commit", laws: [law], results: [resultFor(law)] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "QUALITY_REPORT_INVALID",
  );
});

test("READY report has one exact per-law verdict and no participants", () => {
  const law = fixtureLaw();
  const report = buildQualityReport({
    level: "READY",
    gitCommit: "a".repeat(40),
    laws: [law],
    results: [resultFor(law)],
  });
  assert.equal(report.outcome, "PASS");
  assert.deepEqual(report.participants, []);
  assert.deepEqual(report.laws.map((item) => item.lawId), [law.lawId]);
  assert.deepEqual(report.laws[0]!.requiredEvidenceModes, ["exam.golden", "static.ast"]);
  assert.deepEqual(report.laws[0]!.evidence.map((item) => item.evidenceMode), ["exam.golden", "static.ast"]);
});

test("every active law scope is deterministic, owned, unique, and includes all contract refs", () => {
  const registry = buildRegistry();
  for (const law of registry.laws) {
    const first = computeTargetPaths(law, registry);
    const second = computeTargetPaths(law, registry);
    assert.deepEqual(first, second, law.lawId);
    assert.equal(first.length, new Set(first).size, law.lawId);
    for (const reference of law.contractRefs) assert.ok(first.includes(reference), `${law.lawId}:${reference}`);
  }
});

test("every declared dynamic evidence mode has one executable RELEASE proof route", () => {
  const registry = buildRegistry();
  for (const law of registry.laws) for (const mode of law.evidenceModes.filter((item) => item.startsWith("dynamic."))) {
    assert.ok(dynamicScriptFor(law.capabilityDomain, mode).length > 0, `${law.lawId}:${mode}`);
  }
});
