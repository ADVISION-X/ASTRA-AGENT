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
import { GovernanceError, sha, validateGitIndexEntries, validateRepositoryEntryAt } from "../../scripts/audit/governance-runtime.js";
import {
  buildQualityReport,
  clausesForEvidenceMode,
  clausesForLaw,
  deferredModes,
  requiredModes,
  validEvidenceRef,
  type LawExecutionResult,
} from "../../scripts/audit/shared/quality-contract.js";
import { assertCandidateStable, assertExactProviderContract, assertParticipantCommitIdentity, bindNativeProofObservations, computeTargetPaths, dynamicScriptFor, parseInspectorOutput } from "../../scripts/audit/shared/quality-runner.js";
import { validateProviderContractSpec } from "../../scripts/audit/shared/provider-contract-authority.js";
import type { InspectorContext, InspectorEvaluation } from "../../scripts/audit/shared/inspector-contracts.js";
import { proofObservationPrefix } from "../../scripts/audit/shared/proof-observation.js";
import type { QualityProofRequest } from "../../scripts/audit/shared/proof-observation.js";
import { observationMatchesRoute, proofClauseIndexesFor, relevantExamScripts } from "../../scripts/audit/shared/quality-routes.js";
import {
  finalizeStaticInspection,
  recordSemanticCheck,
  semanticExecutionIsExact,
} from "../../scripts/audit/shared/static-inspector-result.js";
import { staticClauseRoutesForDomain } from "../../scripts/audit/shared/static-clause-routes.js";
import { inspectPerSiteHmac } from "../../scripts/audit/domains/workbench-api-boundary/external-ingress-identity-inspector.js";

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

const fixtureEvidenceDirectory = mkdtempSync(resolve(tmpdir(), "quality-evidence-fixture-"));
const fixtureEvidencePath = resolve(fixtureEvidenceDirectory, "receipt.json");
writeFileSync(fixtureEvidencePath, '{"status":"observed"}\n');
const fixtureEvidenceDigest = sha(readFileSync(fixtureEvidencePath));
const externalFixtureRef = (kind: "exam" | "dynamic", selector: string): string =>
  kind === "exam" ? `exam:package.json#${encodeURIComponent(selector)}`
    : `dynamic:${encodeURIComponent(fixtureEvidencePath)}#${encodeURIComponent(selector)}@${fixtureEvidenceDigest}`;
const resultFor = (law: Law): LawExecutionResult => {
  const required = requiredModes(law, "READY");
  return {
    lawId: law.lawId,
    assertions: required.map((mode) => ({
      clauses: clausesForEvidenceMode(law, required, mode),
      evidenceMode: mode,
      passed: true,
      refs: [mode.startsWith("exam.") ? externalFixtureRef("exam", "script=fixture;exit=0") : "ast:scripts/audit/shared/quality-contract.ts#fixture"],
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
  assert.deepEqual(clausesForEvidenceMode(law, required, "static.ast"), ["summary"]);
  assert.deepEqual(clausesForEvidenceMode(law, required, "exam.golden"), clausesForLaw(law));
});

test("every active Exam and Dynamic route has an explicit object-semantic clause assignment", () => {
  const registry = buildRegistry();
  for (const law of registry.laws) for (const mode of law.evidenceModes) {
    if (!mode.startsWith("exam.") && !mode.startsWith("dynamic.")) continue;
    assert.ok(proofClauseIndexesFor(law.lawId, mode, law.forbidden.length), `${law.lawId}:${mode}`);
  }
});

test("every active Static route has fixed clause coverage bound to domain semantic checks", () => {
  const registry = buildRegistry();
  const domains = [...new Set(registry.laws.map((law) => law.capabilityDomain))].sort();
  const signature = (input: { lawId: string; evidenceMode: string; clauses: readonly string[] }): string =>
    `${input.lawId}\0${input.evidenceMode}\0${JSON.stringify([...input.clauses].sort())}`;
  for (const domain of domains) {
    const laws = registry.laws.filter((law) => law.capabilityDomain === domain);
    const expected = laws.flatMap((law) => {
      const modes = requiredModes(law, "READY");
      return modes.filter((mode) => mode.startsWith("static.")).map((evidenceMode) => signature({
        lawId: law.lawId,
        evidenceMode,
        clauses: clausesForEvidenceMode(law, modes, evidenceMode),
      }));
    }).sort();
    const routes = staticClauseRoutesForDomain(domain);
    assert.deepEqual(routes.map(signature).sort(), expected, domain);
    assert.equal(routes.every((route) => route.semanticChecks.length > 0), true, domain);
  }
});

test("static semantic receipts are emitted only after a checker returns", () => {
  const receipts: Array<{ lawId: string; name: string }> = [];
  assert.throws(() => recordSemanticCheck(receipts, "LAW-A", "inspectA", (() => {
    throw new Error("checker failed");
  })()));
  assert.deepEqual(receipts, []);
  assert.equal(recordSemanticCheck(receipts, "LAW-A", "inspectA", "complete"), "complete");
  assert.deepEqual(receipts, [{ lawId: "LAW-A", name: "inspectA" }]);
});

test("static semantic receipts reject missing, extra, duplicate, and permuted law bindings", () => {
  const checks = [
    { lawId: "LAW-A", evidenceMode: "static.ast", clauses: ["summary"], checkId: "a/static-ast", semanticChecks: ["inspectA"] },
    { lawId: "LAW-B", evidenceMode: "static.ast", clauses: ["summary"], checkId: "b/static-ast", semanticChecks: ["inspectB"] },
  ];
  const exact = [{ lawId: "LAW-A", name: "inspectA" }, { lawId: "LAW-B", name: "inspectB" }];
  assert.equal(semanticExecutionIsExact(checks, exact), true);
  assert.equal(semanticExecutionIsExact(checks, exact.slice(0, 1)), false);
  assert.equal(semanticExecutionIsExact(checks, [...exact, { lawId: "LAW-C", name: "inspectC" }]), false);
  assert.equal(semanticExecutionIsExact(checks, [...exact, exact[0]!]), false);
  assert.equal(semanticExecutionIsExact(checks, [
    { lawId: "LAW-B", name: "inspectA" }, { lawId: "LAW-A", name: "inspectB" },
  ]), false);
});

test("Workbench static inspection rejects global-key and incomplete HMAC mutants", () => {
  const original = readFileSync("src/app/workbench-api-boundary.ts", "utf8");
  const mutants = [
    `${original}\nconst legacy = process.env.GRASSEYE_EXTERNAL_API_KEY;\n`,
    original.replace("const expected = createHmac", "const expected = createHash"),
    original.replace("[sourceSystem, requestId, input.routeRule.method, input.routeRule.path]", "[sourceSystem, requestId]"),
  ];
  const inspect = (source: string): number => {
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile("src/app/workbench-api-boundary.ts", source);
    const findings: Array<Parameters<typeof inspectPerSiteHmac>[0]["findings"][number]> = [];
    inspectPerSiteHmac({
      boundaryPath: "src/app/workbench-api-boundary.ts",
      file,
      findings,
      lawId: "LAW-WORKBENCH-API-BOUNDARY-001-V4",
      summary: { ingressIdentityViolations: 0, perSiteHmacViolations: 0 },
    });
    return findings.length;
  };
  assert.equal(inspect(original), 0);
  for (const mutant of mutants) assert.ok(inspect(mutant) > 0);
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

test("repository evidence locators must resolve to a current regular file", () => {
  assert.equal(validEvidenceRef("ast:does/not/exist.ts#selector%3Dmissing"), false);
  assert.equal(validEvidenceRef("ast:scripts/audit/shared/quality-contract.ts#selector%3Dfixture"), true);
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
  extra.assertions.push({ clauses: ["summary"], evidenceMode: "exam.property", passed: true, refs: [externalFixtureRef("exam", "script=extra;exit=0")] });
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
        refs: [externalFixtureRef("dynamic", "script=service;exit=0")],
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
  fixed.assertions[0]!.refs = [externalFixtureRef("exam", "outcome=PASS")];
  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [fixed] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
});

test("Exam uses a Git-bound replay locator and Dynamic requires a native receipt", () => {
  const law = fixtureLaw();
  const missingExamLocator = resultFor(law);
  missingExamLocator.assertions.find((assertion) => assertion.evidenceMode.startsWith("exam."))!.refs = ["exam:fixture#script%3Dfixture"];
  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [missingExamLocator] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
  assert.equal(validEvidenceRef("exam:package.json#script%3Dfixture"), true);
  assert.equal(validEvidenceRef(`dynamic:${encodeURIComponent(fixtureEvidencePath)}#script%3Dfixture`), false);
  assert.equal(validEvidenceRef(`dynamic:${encodeURIComponent(fixtureEvidencePath)}#script%3Dfixture@${"a".repeat(64)}`), true);
  assert.equal(validEvidenceRef(externalFixtureRef("exam", "script=fixture")), true);
});

test("evidence refs reject absolute repository objects and raw or noncanonical reserved characters", () => {
  assert.equal(validEvidenceRef("ast:/tmp/not-in-repository.ts#selector"), false);
  assert.equal(validEvidenceRef("ast:scripts/audit/shared/quality-contract.ts#raw:selector"), false);
  assert.equal(validEvidenceRef("ast:scripts/audit/shared/quality-contract.ts#raw%3aselector"), false);
  assert.equal(validEvidenceRef("ast:scripts/audit/shared/quality-contract.ts#raw%3Aselector"), true);
});

const proofRequests = (
  routes: Array<{ law: Law; mode: string }>, proofKind: "exam" | "dynamic" = "exam",
): QualityProofRequest[] => routes.map(({ law, mode }) => ({
  lawId: law.lawId, evidenceMode: mode, proofRunId: "a".repeat(64), candidate: "b".repeat(40),
  proofKind,
}));

test("a fixed or unauthenticated stdout marker cannot mint evidence for unexecuted law routes", () => {
  const first = { ...fixtureLaw(), lawId: "LAW-AI-INPUT-GATEWAY-001-V1", capabilityDomain: "ai-input-gateway" };
  const routes = [{ law: first, mode: "exam.golden" }];
  const requests = proofRequests(routes);
  const script = "acceptance:ai-input-gateway";
  assert.equal(bindNativeProofObservations("FIXED_PASS\n", routes, requests, script, "exam").size, 0);
  const oneNativeObservation = `${proofObservationPrefix}${JSON.stringify({
    lawId: first.lawId,
    evidenceMode: "exam.golden",
    locator: "acceptance:provider-boundary:injected-browser",
    observedValue: "first route actually asserted",
    ...requests[0],
  })}\n`;
  assert.equal(bindNativeProofObservations(oneNativeObservation, routes, requests, script, "exam").size, 1);
  const invented = `${proofObservationPrefix}${JSON.stringify({
    lawId: first.lawId, evidenceMode: "exam.golden", locator: "acceptance:provider-boundary:injected-browser",
    observedValue: "forged execution result", proofRunId: "f".repeat(64), candidate: "b".repeat(40),
    proofKind: "exam",
  })}\n`;
  assert.throws(
    () => bindNativeProofObservations(invented, routes, requests, script, "exam"),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
});

test("native proof observations reject one locator reused across law routes", () => {
  const law = { ...fixtureLaw(), lawId: "LAW-AI-INPUT-GATEWAY-002-V1", capabilityDomain: "ai-input-gateway" };
  const routes = [{ law, mode: "exam.golden" }];
  const requests = proofRequests(routes);
  const line = `${proofObservationPrefix}${JSON.stringify({
    lawId: law.lawId,
    evidenceMode: "exam.golden",
    locator: "acceptance:exact-target:caller-owned-lease",
    observedValue: "exact target route executed",
    ...requests[0],
  })}`;
  assert.throws(
    () => bindNativeProofObservations(`${line}\n${line}`, routes, requests, "acceptance:ai-input-gateway", "exam"),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_DUPLICATE",
  );
  assert.throws(
    () => bindNativeProofObservations(`${proofObservationPrefix}{not-json}`, routes, requests, "acceptance:ai-input-gateway", "exam"),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
});

test("a Dynamic producer cannot self-authenticate an invented native object", () => {
  const law = { ...fixtureLaw(), lawId: "LAW-LOCAL-APP-SHELL-001-V5", capabilityDomain: "local-app-shell" };
  const routes = [{ law, mode: "dynamic.service" }];
  const requests = proofRequests(routes, "dynamic");
  const marker = `${proofObservationPrefix}${JSON.stringify({
    lawId: law.lawId, evidenceMode: "dynamic.service", locator: "invented://no-real-object",
    observedValue: "value=forged", receipt: "a".repeat(64), ...requests[0],
  })}`;
  assert.throws(
    () => bindNativeProofObservations(marker, routes, requests, "proof:local-shell-current-runtime", "dynamic"),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
  assert.equal(observationMatchesRoute({ kind: "dynamic", script: "acceptance:xuanxue-ai-production:real-chrome",
    domain: "xuanxue-ai-production", lawId: "LAW-XUANXUE-AI-PRODUCTION-001-V9", mode: "dynamic.browser",
    locator: "dynamic:xuanxue:bound-real-chrome", observedValue: "real chrome claimed" }), false);
  assert.equal(observationMatchesRoute({ kind: "dynamic", script: "proof:local-browser-journal-recovery",
    domain: "local-browser-session", lawId: "LAW-LOCAL-BROWSER-SESSION-004-V6", mode: "dynamic.recovery",
    locator: `/tmp/recovery-receipts/${"a".repeat(64)}.json`, observedValue: "atomic recovery verified" }), true);
  assert.equal(observationMatchesRoute({ kind: "dynamic", script: "acceptance:local-browser-real-chrome",
    domain: "local-browser-session", lawId: "LAW-LOCAL-BROWSER-SESSION-003-V6", mode: "dynamic.browser",
    locator: "/repo/.grasseye-local/browser/proof-events.ndjson#sequence=3", observedValue: "claim and command verified" }), true);
  assert.equal(observationMatchesRoute({ kind: "dynamic", script: "acceptance:xuanxue-ai-production:real-proof-verify",
    domain: "xuanxue-ai-production", lawId: "LAW-XUANXUE-AI-PRODUCTION-001-V9", mode: "dynamic.provider",
    locator: "/repo/.grasseye-local/runtime-data/ai-input-gateway/web-chat-executions",
    observedValue: "provider records verified" }), true);

  const missingNativeMarker = `${proofObservationPrefix}${JSON.stringify({
    lawId: "LAW-LOCAL-BROWSER-SESSION-004-V6", evidenceMode: "dynamic.recovery",
    locator: `/tmp/recovery-receipts/${"c".repeat(64)}.json`, observedValue: "atomic recovery verified",
    receipt: "c".repeat(64), ...proofRequests([{ law: {
      ...law, lawId: "LAW-LOCAL-BROWSER-SESSION-004-V6", capabilityDomain: "local-browser-session",
    }, mode: "dynamic.recovery" }], "dynamic")[0],
  })}`;
  const recoveryLaw = { ...law, lawId: "LAW-LOCAL-BROWSER-SESSION-004-V6", capabilityDomain: "local-browser-session" };
  const recoveryRoutes = [{ law: recoveryLaw, mode: "dynamic.recovery" }];
  assert.throws(
    () => bindNativeProofObservations(missingNativeMarker, recoveryRoutes, proofRequests(recoveryRoutes, "dynamic"),
      "proof:local-browser-journal-recovery", "dynamic"),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
});

test("static finalization rejects a law with no explicit inspector route", async () => {
  const context = {
    project: new Project({ useInMemoryFileSystem: true }),
    selectedLawId: "LAW-FIXTURE-001-V1",
    sealedRoot: "/sealed",
    targetSet: { queryRef: "scope:fixture", count: 1 },
    targetPaths: ["src/fixture.ts"],
    lawRequirements: ["LAW-FIXTURE-001-V1", "LAW-FIXTURE-002-V1"].map((lawId) => ({
      lawId,
      forbiddenCount: 1,
      clausesByMode: { "static.ast": ["summary"] },
      targetPaths: ["src/fixture.ts"],
      targetSet: { queryRef: `scope:${lawId}`, count: 1 },
    })),
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: "scripts/audit/domains/fixture/inspector.ts" },
  } as unknown as InspectorContext;
  await assert.rejects(
    () => finalizeStaticInspection(context, [{ lawId: "LAW-FIXTURE-001-V1" }], function inspectFixture() { return {
      capabilityDomain: "fixture",
      reportedLawIds: ["LAW-FIXTURE-001-V1", "LAW-FIXTURE-002-V1"],
      executedChecks: [],
      findings: [],
      inspectedFiles: ["src/fixture.ts"],
    }; }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_ROUTE_MISSING",
  );
});

test("static finalization rejects a new law clause without an explicit owner check route", async () => {
  const context = {
    sealedRoot: "/sealed",
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: "scripts/audit/domains/fixture/inspector.ts" },
    lawRequirements: [{
      lawId: "LAW-FIXTURE-001-V1",
      forbiddenCount: 1,
      clausesByMode: { "static.ast": ["forbidden:0", "forbidden:1", "summary"] },
      targetPaths: ["src/fixture.ts"],
      targetSet: { queryRef: "scope:fixture", count: 1 },
    }],
  } as unknown as InspectorContext;
  await assert.rejects(
    () => finalizeStaticInspection(context, [{ lawId: "LAW-FIXTURE-001-V1" }], function inspectFixture() { return {
      capabilityDomain: "fixture", reportedLawIds: ["LAW-FIXTURE-001-V1"],
      executedChecks: [], findings: [], inspectedFiles: ["src/fixture.ts"],
    }; }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_ROUTE_MISSING",
  );
});

test("static finalization rejects an omitted executed clause check", async () => {
  const context = {
    sealedRoot: process.cwd(),
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: "scripts/audit/shared/static-inspector-result.ts" },
    lawRequirements: [{
      lawId: "LAW-FIXTURE-001-V1",
      forbiddenCount: 1,
      clausesByMode: { "static.ast": ["forbidden:0", "summary"] },
      targetPaths: ["package.json"],
      targetSet: { queryRef: "scope:LAW-FIXTURE-001-V1#appliesTo-minus-excludes", count: 1 },
    }],
  } as unknown as InspectorContext;
  await assert.rejects(
    () => finalizeStaticInspection(context, [{ lawId: "LAW-FIXTURE-001-V1" }], function inspectFixture() { return {
      capabilityDomain: "fixture", reportedLawIds: ["LAW-FIXTURE-001-V1"], findings: [], inspectedFiles: ["package.json"],
      executedChecks: [{
        lawId: "LAW-FIXTURE-001-V1", evidenceMode: "static.ast", clauses: ["summary"],
        checkId: "fixture/summary-check", semanticChecks: ["inspectFixture"],
      }],
    }; }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE",
  );
});

test("static finalization invokes the named owner executor and rejects an unreadable complete target set", async () => {
  const context = {
    sealedRoot: "/sealed",
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: "scripts/audit/domains/fixture/inspector.ts" },
    lawRequirements: [{
      lawId: "LAW-FIXTURE-001-V1",
      forbiddenCount: 1,
      clausesByMode: { "static.ast": ["forbidden:0", "summary"] },
      targetPaths: ["src/fixture-a.ts", "src/fixture-b.ts"],
      targetSet: { queryRef: "scope:LAW-FIXTURE-001-V1#appliesTo-minus-excludes", count: 2 },
    }],
  } as unknown as InspectorContext;
  let executed = false;
  await assert.rejects(
    () => finalizeStaticInspection(context, [{ lawId: "LAW-FIXTURE-001-V1" }], function inspectFixture() { executed = true; return {
      capabilityDomain: "fixture", reportedLawIds: ["LAW-FIXTURE-001-V1"],
      executedChecks: [], findings: [], inspectedFiles: ["src/fixture-a.ts"],
    }; }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE",
  );
  assert.equal(executed, true);
});

test("a no-op inspector cannot mint PASS from a readable complete target set", async () => {
  const context = {
    sealedRoot: process.cwd(),
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: "scripts/audit/shared/static-inspector-result.ts" },
    lawRequirements: [{
      lawId: "LAW-FIXTURE-001-V1", forbiddenCount: 1,
      clausesByMode: { "static.ast": ["forbidden:0", "summary"] },
      targetPaths: ["package.json"],
      targetSet: { queryRef: "scope:LAW-FIXTURE-001-V1#appliesTo-minus-excludes", count: 1 },
    }],
  } as unknown as InspectorContext;
  await assert.rejects(
    () => finalizeStaticInspection(context, [{ lawId: "LAW-FIXTURE-001-V1" }], function inspectNothing() { return {
      capabilityDomain: "fixture", reportedLawIds: ["LAW-FIXTURE-001-V1"], findings: [], inspectedFiles: ["package.json"],
    } as unknown as InspectorEvaluation; }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE",
  );
});

test("an unrelated function call cannot authenticate a copied static clause plan", async () => {
  const context = {
    sealedRoot: process.cwd(),
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: "scripts/audit/shared/static-inspector-result.ts" },
    lawRequirements: [{
      lawId: "LAW-FIXTURE-001-V1", forbiddenCount: 1,
      clausesByMode: { "static.ast": ["forbidden:0", "summary"] },
      targetPaths: ["package.json"],
      targetSet: { queryRef: "scope:LAW-FIXTURE-001-V1#appliesTo-minus-excludes", count: 1 },
    }],
  } as unknown as InspectorContext;
  await assert.rejects(
    () => finalizeStaticInspection(context, [{ lawId: "LAW-FIXTURE-001-V1" }], function inspectNothing() { String("unrelated-call"); return {
      capabilityDomain: "fixture", reportedLawIds: ["LAW-FIXTURE-001-V1"], findings: [], inspectedFiles: ["package.json"],
      executedChecks: [{
        lawId: "LAW-FIXTURE-001-V1", evidenceMode: "static.ast", clauses: ["forbidden:0", "summary"],
        checkId: "fixture/copied-request-plan", semanticChecks: ["String"],
      }],
    }; }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE",
  );
});

test("a finding propagates from one law result to the only top-level verdict", () => {
  const law = fixtureLaw();
  const result = resultFor(law);
  result.assertions[0]!.passed = false;
  result.findings = [{ code: "FIXTURE_MUTATION_FOUND", evidenceRefs: [externalFixtureRef("exam", "mutation=1")] }];
  const report = buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [result] });
  assert.equal(report.laws[0]!.outcome, "FAIL");
  assert.equal(report.outcome, "FAIL");
});

test("candidate and provider mutations fail closed with fixed governance codes", () => {
  assert.throws(
    () => assertCandidateStable("a".repeat(64), "b".repeat(64), "mutation"),
    (error: unknown) => error instanceof GovernanceError && error.code === "CANDIDATE_DRIFT",
  );
  const dependency = { contractId: "xuanxue.report", providerRepo: "ADVISION-X/xuanxue-web", providerDomain: "ai-acceptance", version: 3 };
  assert.throws(
    () => assertExactProviderContract(dependency.providerRepo, dependency, []),
    (error: unknown) => error instanceof GovernanceError && error.code === "EXTERNAL_SURFACE_AUTHORITY_MISSING",
  );
  assert.throws(
    () => assertExactProviderContract(dependency.providerRepo, dependency, [{ ...dependency, version: 2 }]),
    (error: unknown) => error instanceof GovernanceError && error.code === "EXTERNAL_SURFACE_AUTHORITY_MISSING",
  );
});

test("provider contracts reject malformed payloads before identity matching", () => {
  const valid = {
    schemaVersion: 1, specId: "xuanxue.report", status: "active", version: 3,
    owner: "ai-acceptance", lawIds: ["LAW-AI-ACCEPTANCE-001-V1"], specKind: "cross-repo-contract",
    contract: {
      contractId: "xuanxue.report", version: 3, providerRepo: "ADVISION-X/xuanxue-web",
      providerDomain: "ai-acceptance", authorityArtifact: { path: "artifacts/report.json", selector: "version=3" },
    },
  };
  assert.doesNotThrow(() => validateProviderContractSpec(valid, "ADVISION-X/xuanxue-web", new Set(["ai-acceptance"]), () => true));
  for (const malformed of [
    { ...valid, unexpected: true },
    { ...valid, contract: { ...valid.contract, providerDomain: "wrong-domain" } },
    { ...valid, contract: { ...valid.contract, authorityArtifact: null } },
    { ...valid, contract: { ...valid.contract, authorityArtifact: { ...valid.contract.authorityArtifact, unknown: true } } },
  ]) assert.throws(
    () => validateProviderContractSpec(malformed, "ADVISION-X/xuanxue-web", new Set(["ai-acceptance"]), () => true),
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

test("law parser rejects duplicate YAML keys and non-canonical source bytes", () => {
  const source = readFileSync(BASE, "utf8");
  assert.throws(
    () => parseLawSource(source.replace("schemaVersion: 2\n", "schemaVersion: 2\nschemaVersion: 2\n"), BASE, "base-law", 100),
    (error: unknown) => error instanceof GovernanceError && error.code === "SOURCE_PARSE_FAILED",
  );
  assert.throws(
    () => parseLawSource(source.replaceAll("\n", "\r\n"), BASE, "base-law", 100),
    (error: unknown) => error instanceof GovernanceError && error.code === "SOURCE_PARSE_FAILED",
  );
  assert.throws(
    () => parseLawSource(`\ufeff${source}`, BASE, "base-law", 100),
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
  const contexts = [new Set([law.lawId]), domains, new Set<string>(), new Map<string, string>(), new Map([[law.lawId, law.capabilityDomain]])] as const;
  assert.equal(blueprintValid(base, ...contexts), true);
  const invalid = { ...base, dependencyEdges: [{ contractRef: null,
    from: { domain: law.capabilityDomain, repo: "local", unexpected: true },
    to: { domain: secondDomain, repo: "local" } }] };
  assert.equal(blueprintValid(invalid, ...contexts), false);
  const remoteRef = "docs/specs/remote.dependency.spec.json";
  const remoteBase = { ...base, contractRefs: [remoteRef], dependencyEdges: [{ contractRef: remoteRef,
    from: { domain: law.capabilityDomain, repo: "local" },
    to: { domain: "provider-authority", repo: "ADVISION-X/provider" } }] };
  assert.equal(blueprintValid(remoteBase, new Set([law.lawId]), domains, new Set([remoteRef]),
    new Map([[remoteRef, "ADVISION-X/provider"]]), new Map([[law.lawId, law.capabilityDomain]])), true);
  assert.equal(blueprintValid(remoteBase, new Set([law.lawId]), domains, new Set([remoteRef]),
    new Map([[remoteRef, "ADVISION-X/other"]]), new Map([[law.lawId, law.capabilityDomain]])), false);
  const foreignLawId = "LAW-BLUEPRINT-FOREIGN-001-V1";
  const foreignLawEdge = { ...base, prohibitedDependencyEdges: [{
    from: { domain: law.capabilityDomain, repo: "local" },
    lawId: foreignLawId,
    to: { domain: secondDomain, repo: "local" },
  }] };
  assert.equal(blueprintValid(
    foreignLawEdge,
    new Set([law.lawId, foreignLawId]),
    domains,
    new Set<string>(),
    new Map<string, string>(),
    new Map([[law.lawId, law.capabilityDomain], [foreignLawId, law.capabilityDomain]]),
  ), false);
  assert.throws(
    () => validateLocalSpecContract({ owner: law.capabilityDomain, specKind: "config", contract: { arbitrary: "value" } }, "mutation.json"),
    (error: unknown) => error instanceof GovernanceError && error.code === "SOURCE_PARSE_FAILED",
  );
  assert.throws(
    () => validateLocalSpecContract({ owner: law.capabilityDomain, specKind: "config", contract: { keys: { "<key>": "<value>" } } }, "placeholder.json"),
    (error: unknown) => error instanceof GovernanceError && error.code === "SOURCE_PARSE_FAILED",
  );
  assert.doesNotThrow(() => validateLocalSpecContract({
    owner: law.capabilityDomain,
    specKind: "migration",
    contract: {
      currentAuthority: "legacy-authority",
      targetAuthority: "current-authority",
      compatibilityMechanisms: ["time-bounded dual-read owned by migration owner"],
      startDate: "2026-08-25",
      monitoring: ["legacy read count reaches zero"],
      rollbackCondition: "restore the prior authority",
      maximumDurationDays: 1,
      removalDate: "2026-08-26",
      removalAcceptance: ["legacy reader is physically deleted"],
    },
  }, "migration.json"));
  assert.throws(
    () => validateLocalSpecContract({
      owner: law.capabilityDomain,
      specKind: "migration",
      contract: {
        currentAuthority: "legacy-authority", targetAuthority: "current-authority",
        compatibilityMechanisms: [], monitoring: [], removalAcceptance: [],
        startDate: "2026-08-25", removalDate: "2026-08-26", maximumDurationDays: 1,
        rollbackCondition: "restore the prior authority",
      },
    }, "empty-migration-controls.json"),
    (error: unknown) => error instanceof GovernanceError && error.code === "SOURCE_PARSE_FAILED",
  );
  assert.throws(
    () => validateLocalSpecContract({
      owner: law.capabilityDomain,
      specKind: "migration",
      contract: {
        deleteAcceptance: "deleted", deleteDate: "2026-08-26", endDate: "2026-08-26",
        monitoringMetric: "errors", newPath: "new", oldPath: "old", owner: law.capabilityDomain,
        rollbackCondition: "rollback", startDate: "2026-08-25",
      },
    }, "alternate-migration.json"),
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
    "acceptance:app-shell-ui",
    "acceptance:capability-governance",
    "acceptance:code-purity-zombie-deep",
    "acceptance:forensics-persistence-capability",
    "acceptance:system-security",
  ]);
  assert.equal(relevantExamScripts(["src/lib/storage/fixture.ts"], registry)
    .includes("acceptance:xuanxue-ai-production"), false);
});
