import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { Project } from "ts-morph";

import { BASE, assertProjectionEqual, blueprintValid, buildRegistry, parseLawSource, type Law } from "../../scripts/audit/governance-authority.js";
import { addedSourceAt } from "../../scripts/audit/governance.js";
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
import { assertCandidateStable, assertExactProviderContract, assertParticipantCommitIdentity, bindNativeProofObservations, computeTargetPaths, dynamicScriptFor, parseInspectorOutput } from "../../scripts/audit/shared/quality-runner.js";
import type { InspectorContext } from "../../scripts/audit/shared/inspector-contracts.js";
import { proofObservationPrefix } from "../../scripts/audit/shared/proof-observation.js";
import { relevantExamScripts } from "../../scripts/audit/shared/quality-routes.js";
import { finalizeStaticInspection } from "../../scripts/audit/shared/static-inspector-result.js";

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
      refs: [mode.startsWith("exam.") ? `exam:fixture#script%3Dfixture%3Bexit%3D0@${"a".repeat(64)}` : "ast:src/fixture/index.ts#fixture"],
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

test("quality report rejects missing, duplicate, and extra active law results", () => {
  const first = fixtureLaw();
  const second = { ...fixtureLaw(), lawId: "LAW-FIXTURE-002-V1" };
  const laws = [first, second];
  const exact = [resultFor(first), resultFor(second)];
  for (const results of [
    exact.slice(0, 1),
    [exact[0]!, exact[0]!],
    [...exact, resultFor({ ...fixtureLaw(), lawId: "LAW-FIXTURE-003-V1" })],
  ]) assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws, results }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_DENOMINATOR_MISSING",
  );
});

test("quality report rejects duplicate and extra required evidence modes", () => {
  const law = fixtureLaw();
  const duplicate = resultFor(law);
  duplicate.assertions.push({ ...duplicate.assertions[0]!, refs: [...duplicate.assertions[0]!.refs] });
  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [duplicate] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_DUPLICATE",
  );
  const extra = resultFor(law);
  extra.assertions.push({ clauses: ["summary"], evidenceMode: "exam.property", passed: true, refs: [`exam:fixture#script%3Dextra%3Bexit%3D0@${"a".repeat(64)}`] });
  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [extra] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "UNDECLARED_EVIDENCE_MODE",
  );
});

test("RELEASE rejects a missing Dynamic Proof and missing or drifted participant commit", () => {
  const law = fixtureLaw();
  assert.throws(
    () => buildQualityReport({ level: "RELEASE", gitCommit: "a".repeat(40), laws: [law], results: [resultFor(law)] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
  assert.throws(
    () => buildQualityReport({ level: "RELEASE", gitCommit: "a".repeat(40), laws: [law], results: [{
      ...resultFor(law),
      assertions: [...resultFor(law).assertions, {
        clauses: ["summary"], evidenceMode: "dynamic.service", passed: true,
        refs: [`dynamic:fixture#script%3Dservice%3Bexit%3D0@${"a".repeat(64)}`],
      }],
    }], participants: [{ repo: "ADVISION-X/provider", gitCommit: "", contracts: [{ contractId: "fixture", version: 1 }] }] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "QUALITY_PARTICIPANTS_INVALID",
  );
  assert.throws(
    () => assertParticipantCommitIdentity("a".repeat(40), "b".repeat(40), "ADVISION-X/provider"),
    (error: unknown) => error instanceof GovernanceError && error.code === "RELEASE_PARTICIPANT_DRIFT",
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
  fixed.assertions[0]!.refs = [`exam:fixture#outcome%3DPASS@${"a".repeat(64)}`];
  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [fixed] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
});

test("external Exam and Dynamic evidence requires a native receipt or SHA-256 suffix", () => {
  const law = fixtureLaw();
  const missingExamReceipt = resultFor(law);
  missingExamReceipt.assertions.find((assertion) => assertion.evidenceMode.startsWith("exam."))!.refs = ["exam:fixture#script%3Dfixture"];
  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [missingExamReceipt] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
});

test("a fixed stdout marker cannot mint evidence for unexecuted law routes", () => {
  const first = fixtureLaw();
  const second = { ...fixtureLaw(), lawId: "LAW-FIXTURE-002-V1" };
  const routes = [
    { law: first, mode: "exam.golden" },
    { law: second, mode: "exam.golden" },
  ];
  assert.equal(bindNativeProofObservations("FIXED_PASS\n", routes).size, 0);
  const oneNativeObservation = `${proofObservationPrefix}${JSON.stringify({
    lawId: first.lawId,
    evidenceMode: "exam.golden",
    locator: "acceptance:fixture:first",
    observedValue: "first route actually asserted",
  })}\n`;
  assert.equal(bindNativeProofObservations(oneNativeObservation, routes).size, 1,
    "one native observation must not synthesize the second law route");
});

test("native proof observations reject one locator reused across law routes", () => {
  const first = fixtureLaw();
  const second = { ...fixtureLaw(), lawId: "LAW-FIXTURE-002-V1" };
  const lines = [first, second].map((law) => `${proofObservationPrefix}${JSON.stringify({
    lawId: law.lawId,
    evidenceMode: "exam.golden",
    locator: "acceptance:fixture:reused",
    observedValue: law.lawId,
  })}`).join("\n");
  assert.throws(
    () => bindNativeProofObservations(lines, [
      { law: first, mode: "exam.golden" },
      { law: second, mode: "exam.golden" },
    ]),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_DUPLICATE",
  );
  assert.throws(
    () => bindNativeProofObservations(`${proofObservationPrefix}{not-json}`, [
      { law: first, mode: "exam.golden" },
    ]),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
});

test("static finalization rejects a law with no explicit inspector route", () => {
  const context = {
    project: new Project({ useInMemoryFileSystem: true }),
    selectedLawId: "LAW-FIXTURE-001-V1",
    sealedRoot: "/sealed",
    targetSet: { queryRef: "scope:fixture", count: 1, sha256: "a".repeat(64) },
    targetPaths: ["src/fixture.ts"],
    lawRequirements: ["LAW-FIXTURE-001-V1", "LAW-FIXTURE-002-V1"].map((lawId) => ({
      lawId,
      clausesByMode: { "static.ast": ["summary"] },
      targetPaths: ["src/fixture.ts"],
      targetSet: { queryRef: `scope:${lawId}`, count: 1, sha256: "a".repeat(64) },
    })),
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: "scripts/audit/domains/fixture/inspector.ts" },
  } as unknown as InspectorContext;
  assert.throws(
    () => finalizeStaticInspection(context, {
      capabilityDomain: "fixture",
      reportedLawIds: ["LAW-FIXTURE-001-V1", "LAW-FIXTURE-002-V1"],
      findings: [],
      inspectedFiles: ["src/fixture.ts"],
    }, [{ lawId: "LAW-FIXTURE-001-V1", forbiddenCount: 1, checkIds: ["fixture/explicit-check"] }]),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_ROUTE_MISSING",
  );
});

test("static finalization rejects a new law clause without an explicit owner check route", () => {
  const context = {
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: "scripts/audit/domains/fixture/inspector.ts" },
    lawRequirements: [{
      lawId: "LAW-FIXTURE-001-V1",
      clausesByMode: { "static.ast": ["forbidden:0", "forbidden:1", "summary"] },
      targetPaths: ["src/fixture.ts"],
      targetSet: { queryRef: "scope:fixture", count: 1, sha256: "a".repeat(64) },
    }],
  } as unknown as InspectorContext;
  assert.throws(
    () => finalizeStaticInspection(context, {
      capabilityDomain: "fixture", reportedLawIds: ["LAW-FIXTURE-001-V1"],
      findings: [], inspectedFiles: ["src/fixture.ts"],
    }, [{ lawId: "LAW-FIXTURE-001-V1", forbiddenCount: 1, checkIds: ["fixture/explicit-check"] }]),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_ROUTE_MISSING",
  );
});

test("a finding propagates from one law result to the only top-level verdict", () => {
  const law = fixtureLaw();
  const result = resultFor(law);
  result.assertions[0]!.passed = false;
  result.findings = [{ code: "FIXTURE_MUTATION_FOUND", evidenceRefs: [`exam:fixture#mutation%3D1@${"a".repeat(64)}`] }];
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

test("an untracked high-impact addition is included in CHANGE authorization input", () => {
  const root = mkdtempSync(resolve(tmpdir(), "governance-untracked-high-impact-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "governance@example.invalid"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Governance Fixture"], { cwd: root });
  writeFileSync(resolve(root, "README.md"), "fixture\n");
  execFileSync("git", ["add", "README.md"], { cwd: root });
  execFileSync("git", ["commit", "-q", "-m", "fixture"], { cwd: root });
  mkdirSync(resolve(root, "src"));
  writeFileSync(resolve(root, "src", "listener.ts"), "server.listen(9000);\n");
  assert.match(addedSourceAt(root, { status: "A", path: "src/listener.ts" }), /\.listen\(9000\)/u);
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

test("Shell browser and service Dynamic Proof share one current-run runtime route", () => {
  const expected = "proof:local-shell-current-runtime";
  assert.equal(dynamicScriptFor("local-app-shell", "dynamic.browser"), expected);
  assert.equal(dynamicScriptFor("local-app-shell", "dynamic.service"), expected);
  assert.equal(dynamicScriptFor("startup-entrypoint", "dynamic.service"), expected);
  assert.equal(dynamicScriptFor("workbench-api-boundary", "dynamic.browser"), expected);
  const source = readFileSync("scripts/acceptance/local-shell-current-runtime.dynamic.ts", "utf8");
  for (const token of ["GOVERNANCE_PROOF_RUN_ID", "GOVERNANCE_PROOF_CANDIDATE", "launch-grasseye.mjs", "chromium.launch", "listenerPids(port)"]) {
    assert.ok(source.includes(token), token);
  }
  assert.equal(readFileSync("scripts/acceptance/startup-initialization-health.acceptance.ts", "utf8").includes('evidenceMode: "dynamic.'), false);
  for (const retired of [
    "scripts/acceptance/app-shell-ui.real-chrome.ts",
    "scripts/acceptance/app-shell-real-chrome-proof-support.ts",
    "scripts/acceptance/capture-app-shell-ui.real-chrome.ts",
  ]) assert.equal(existsSync(retired), false, retired);
});

test("CHANGE routes an ordinary Exam to every affected domain without running unrelated domains", () => {
  const registry = buildRegistry();
  assert.deepEqual(relevantExamScripts(["src/lib/storage/fixture.ts"], registry), [
    "acceptance:code-purity-zombie-deep",
    "acceptance:forensics-persistence-capability",
    "acceptance:system-security",
  ]);
  assert.equal(relevantExamScripts(["src/lib/storage/fixture.ts"], registry)
    .includes("acceptance:xuanxue-ai-production"), false);
});
