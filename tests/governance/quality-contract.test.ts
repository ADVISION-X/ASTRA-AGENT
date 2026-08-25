import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { BASE, assertProjectionEqual, blueprintValid, buildRegistry, parseLawSource, type Law } from "../../scripts/audit/governance-authority.js";
import { validateLocalSpecContract } from "../../scripts/audit/governance-local-spec-contract.js";
import { GovernanceError, validateGitIndexEntries, validateRepositoryEntryAt } from "../../scripts/audit/governance-runtime.js";
import {
  buildQualityReport,
  clausesForEvidenceMode,
  clausesForLaw,
  deferredModes,
  requiredModes,
  type LawExecutionResult,
} from "../../scripts/audit/shared/quality-contract.js";
import { assertCandidateStable, assertExactProviderContract, computeTargetPaths, dynamicScriptFor, parseInspectorOutput } from "../../scripts/audit/shared/quality-runner.js";

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
      refs: [mode.startsWith("exam.") ? "exam:fixture#script%3Dfixture%3Bexit%3D0" : "ast:src/fixture/index.ts#fixture"],
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
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );

  const falseWithoutFinding = resultFor(law);
  falseWithoutFinding.assertions[0]!.passed = false;
  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [falseWithoutFinding] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_FAILED",
  );
});

test("quality report rejects wrong evidence types, duplicate clause claims, and invalid candidates", () => {
  const law = fixtureLaw();
  const wrongKind = resultFor(law);
  wrongKind.assertions.find((assertion) => assertion.evidenceMode === "static.ast")!.refs = ["file:src/fixture/index.ts#fixture"];
  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [wrongKind] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );

  const duplicate = resultFor(law);
  duplicate.assertions.push({ ...duplicate.assertions[0]!, refs: [...duplicate.assertions[0]!.refs] });
  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [duplicate] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_DUPLICATE",
  );

  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "not-a-commit", laws: [law], results: [resultFor(law)] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "QUALITY_REPORT_INVALID",
  );
});

test("quality report rejects empty and fixed-PASS evidence references", () => {
  const law = fixtureLaw();
  const empty = resultFor(law);
  empty.assertions[0]!.refs = [];
  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [empty] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "EMPTY_EVIDENCE_REFS",
  );
  const fixed = resultFor(law);
  fixed.assertions[0]!.refs = ["exam:fixture#outcome%3DPASS"];
  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [fixed] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
});

test("a finding propagates from one law result to the only top-level verdict", () => {
  const law = fixtureLaw();
  const result = resultFor(law);
  result.assertions[0]!.passed = false;
  result.findings = [{ code: "FIXTURE_MUTATION_FOUND", evidenceRefs: ["exam:fixture#mutation%3D1"] }];
  const report = buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [result] });
  assert.equal(report.laws[0]!.outcome, "FAIL");
  assert.equal(report.outcome, "FAIL");
});

test("candidate and provider mutations fail closed with fixed governance codes", () => {
  assert.throws(
    () => assertCandidateStable("a".repeat(64), "b".repeat(64), "mutation"),
    (error: unknown) => error instanceof GovernanceError && error.code === "CANDIDATE_DRIFT",
  );
  const dependency = { contractId: "xuanxue.report", providerRepo: "ADVISION-X/xuanxue-web", version: 3 };
  assert.throws(
    () => assertExactProviderContract(dependency.providerRepo, dependency, []),
    (error: unknown) => error instanceof GovernanceError && error.code === "EXTERNAL_SURFACE_AUTHORITY_MISSING",
  );
  assert.throws(
    () => assertExactProviderContract(dependency.providerRepo, dependency, [{ ...dependency, version: 2 }]),
    (error: unknown) => error instanceof GovernanceError && error.code === "EXTERNAL_SURFACE_AUTHORITY_MISSING",
  );
});

test("hidden inspector errors, stale projections, and unsafe index states fail closed", () => {
  assert.throws(
    () => parseInspectorOutput("hidden exception without receipt", "fixture"),
    (error: unknown) => error instanceof GovernanceError && error.code === "CHECK_EXECUTION_FAILED",
  );
  assert.throws(
    () => assertProjectionEqual(Buffer.from("current"), Buffer.from("stale")),
    (error: unknown) => error instanceof GovernanceError && error.code === "GENERATED_PROJECTION_STALE",
  );
  assert.throws(
    () => validateGitIndexEntries("100644 unmerged", []),
    (error: unknown) => error instanceof GovernanceError && error.code === "SOURCE_PARSE_FAILED",
  );
  assert.throws(
    () => validateGitIndexEntries("", ["160000 deadbeef 0\tvendor/repo"]),
    (error: unknown) => error instanceof GovernanceError && error.code === "SOURCE_PARSE_FAILED",
  );
});

test("filesystem mutation probes reject escaping symlinks and special devices", () => {
  const root = mkdtempSync(resolve(tmpdir(), "governance-path-mutation-"));
  const outside = resolve(root, "..", `outside-${process.pid}.txt`);
  writeFileSync(outside, "outside");
  symlinkSync(outside, resolve(root, "escape"));
  assert.throws(
    () => validateRepositoryEntryAt(root, "escape"),
    (error: unknown) => error instanceof GovernanceError && error.code === "TARGET_OUTSIDE_DOMAIN_AUTHORITY",
  );
  execFileSync("mkfifo", [resolve(root, "special")]);
  assert.throws(
    () => validateRepositoryEntryAt(root, "special"),
    (error: unknown) => error instanceof GovernanceError && error.code === "SOURCE_PARSE_FAILED",
  );
});

test("law parser rejects a second front-matter block", () => {
  const source = readFileSync(BASE, "utf8");
  assert.throws(
    () => parseLawSource(`${source}\n---\n`, BASE, "base-law", 100),
    (error: unknown) => error instanceof GovernanceError && error.code === "SOURCE_PARSE_FAILED",
  );
});

test("blueprint edge schema and local spec payloads reject arbitrary fields", () => {
  const registry = buildRegistry();
  const law = registry.laws[0]!;
  const domains = new Set(registry.domains.map((domain) => domain.capabilityDomain));
  const secondDomain = registry.domains.find((domain) => domain.capabilityDomain !== law.capabilityDomain)!.capabilityDomain;
  const base = {
    blueprintId: "BLUEPRINT-MUTATION-V1", contractRefs: [], dependencyEdges: [], lawIds: [law.lawId],
    owner: law.capabilityDomain, prohibitedDependencyEdges: [], schemaVersion: 1, status: "active",
  };
  const contexts = [new Set([law.lawId]), domains, new Set<string>(), new Map<string, Set<string>>(), new Map([[law.lawId, law.capabilityDomain]])] as const;
  assert.equal(blueprintValid(base, ...contexts), true);
  const invalid = { ...base, dependencyEdges: [{ contractRef: null,
    from: { domain: law.capabilityDomain, repo: "local", unexpected: true },
    to: { domain: secondDomain, repo: "local" } }] };
  assert.equal(blueprintValid(invalid, ...contexts), false);
  assert.throws(
    () => validateLocalSpecContract({ owner: law.capabilityDomain, specKind: "config", contract: { arbitrary: "value" } }, "mutation.json"),
    (error: unknown) => error instanceof GovernanceError && error.code === "SOURCE_PARSE_FAILED",
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
