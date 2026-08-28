import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { Project } from "ts-morph";

import { BASE, assertProjectionEqual, blueprintValid, buildRegistry, parseLawSource, type Law } from "../../scripts/audit/governance-authority.js";
import { addedSourceAt, assertProjectionStable } from "../../scripts/audit/governance.js";
import { validateLocalSpecContract } from "../../scripts/audit/governance-local-spec-contract.js";
import {
  decodeGitPathBytes,
  GovernanceError,
  sha,
  validateGitIndexEntries,
  validateRepositoryEntryAt,
  walkAt,
} from "../../scripts/audit/governance-runtime.js";
import { observeProductionProofCleanup } from "../../scripts/acceptance/agent-production-runtime.real-proof-cleanup.js";
import {
  buildQualityReport,
  deferredModes,
  requiredModes,
  validEvidenceRef,
  type LawExecutionResult,
} from "../../scripts/audit/shared/quality-contract.js";
import { assertCandidateStable, assertExactProviderContract, assertParticipantCommitIdentity, bindNativeProofObservations, computeTargetPaths, dynamicScriptFor, parseInspectorOutput } from "../../scripts/audit/shared/quality-runner.js";
import { validateProviderContractSpec } from "../../scripts/audit/shared/provider-contract-authority.js";
import type { InspectorContext } from "../../scripts/audit/shared/inspector-contracts.js";
import { proofObservationPrefix, validateDynamicReceiptPayload } from "../../scripts/audit/shared/proof-observation.js";
import type { QualityProofRequest } from "../../scripts/audit/shared/proof-observation.js";
import { relevantExamScripts } from "../../scripts/audit/shared/quality-routes.js";
import { producerModePassed, recordStaticCheck, staticClauses, staticEvidenceRefs, validateStaticInspection } from "../../scripts/audit/shared/static-inspection-contract.js";
import { inspectPerSiteHmac } from "../../scripts/audit/domains/workbench-api-boundary/external-ingress-identity-inspector.js";
import { exactTextMatcherIsStrict } from "../../scripts/audit/domains/local-browser-session/mutation-atomicity-inspection.js";
import { redactHashWriteOrderIsExact } from "../../scripts/audit/domains/runtime-log-spine/inspector.js";

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
const fixtureDynamicClauses = ["forbidden:4", "forbidden:8"];
writeFileSync(fixtureEvidencePath, `${JSON.stringify({
  schema_version: "governance-dynamic-observation.v2",
  proof_run_id: "a".repeat(64), candidate: "b".repeat(40), captured_at: "2026-08-27T00:00:00.000Z",
  lawId: "LAW-LOCAL-APP-SHELL-001-V6", evidenceMode: "dynamic.service",
  observation_kind: "service", clauses: fixtureDynamicClauses, observed_value: "fixture",
  producer_script: "proof:local-shell-current-runtime",
  observation: {
    cleanupVerified: true, components: ["app-shell"], endpoint: "http://127.0.0.1:4173",
    facts: { listener_count: 1, readiness_component_count: 2, readiness_components_distinct: true },
    processId: 4173, serviceName: "fixture-service", sourceFingerprint: "fixture-source", status: "healthy",
  },
})}\n`);
const fixtureEvidenceDigest = sha(readFileSync(fixtureEvidencePath));
const staticReceipt = (lawId: string, check: string, passed = true) => [{ check, lawId, passed }];
const staticNativeRef = (lawId: string, mode: string, clauses: readonly string[], check: string,
  path = "scripts/audit/shared/static-inspection-contract.ts", passed = true): string[] => {
  const kind = ({ "static.ast": "ast", "static.contract": "config", "static.types": "test",
    "static.dependency": "dependency", "static.filesystem": "file", "static.config": "config",
    "static.json": "json", "static.yaml": "yaml" } as Readonly<Record<string, string>>)[mode]!;
  return [`${kind}:${path}#${encodeURIComponent(
    `lawId=${lawId};mode=${mode};semanticChecks=${check};executionResult=${passed ? "passed" : "failed"};object=fixture;clauses=${clauses.join(",")}`,
  )}`];
};
const externalFixtureRef = (kind: "exam" | "dynamic", selector: string): string =>
  kind === "exam" ? `exam:package.json#${encodeURIComponent(selector)}`
    : `dynamic:${encodeURIComponent(fixtureEvidencePath)}#${encodeURIComponent(selector)}@${fixtureEvidenceDigest}`;
const resultFor = (law: Law): LawExecutionResult => {
  const required = requiredModes(law, "READY");
  const denominator = [...law.forbidden.map((_, index) => `forbidden:${index}`), "summary"].sort();
  return {
    lawId: law.lawId,
    assertions: required.map((mode) => ({
      clauses: mode.startsWith("exam.") ? denominator : ["summary"],
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

test("producer-owned evidence covers the exact clause denominator without blanket duplication", () => {
  const law = fixtureLaw();
  const result = resultFor(law);
  const report = buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [result] });
  assert.equal(report.outcome, "PASS");
  assert.notDeepEqual(result.assertions[0]!.clauses, result.assertions[1]!.clauses);
  result.assertions.find((assertion) => assertion.evidenceMode === "exam.golden")!.clauses = ["summary"];
  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [result] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CLAUSE_DENOMINATOR_MISMATCH",
  );
});

test("Workbench static inspection changes verdict for global-key and incomplete HMAC mutants", () => {
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
      lawId: "LAW-WORKBENCH-API-BOUNDARY-001-V6",
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
const examRef = (selector: string): string => `exam:package.json#${encodeURIComponent(selector)}`;
const dynamicRef = (
  request: QualityProofRequest, locator: string, receipt: string, script: string,
): string => `dynamic:${encodeURIComponent(locator)}#${encodeURIComponent([
  `lawId=${request.lawId}`, `mode=${request.evidenceMode}`, `command=npm run ${script}`,
  "case=fixture", `run=${request.proofRunId}`, `candidate=${request.candidate}`,
  "timeoutMs=1", "observedValue=fixture",
].join(";"))}@${receipt}`;
const directObservation = (
  request: QualityProofRequest, clauses: string[], refs: string[],
): Record<string, unknown> => ({ ...request, clauses, passed: true, refs, findings: [] });

test("each Dynamic mode authenticates its native object, clause binding, and observed value", () => {
  const base = {
    schema_version: "governance-dynamic-observation.v2", proof_run_id: "a".repeat(64),
    candidate: "b".repeat(40), captured_at: "2026-08-27T00:00:00.000Z",
    observed_value: "native-fixture", producer_script: "acceptance:agent-production-runtime:real-proof",
  };
  const observations = {
    browser: { browserVersion: "Chromium 1", endpoint: "https://example.test/", pageTitle: "Fixture",
      facts: { authority_present: true, extension_worker_count: 1 }, sessionFacts: { exactTarget: true } },
    service: { cleanupVerified: true, components: ["fixture"], endpoint: "http://127.0.0.1:4173",
      facts: { browser_context_closed: true, cleanup_verified: true,
        readiness_dimension_count: 4, readiness_dimensions_distinct: true, workbench_stopped: true },
      processId: 4173, serviceName: "fixture", sourceFingerprint: "sha256:fixture", status: "healthy" },
    database: { databaseEngine: "sqlite", databasePath: "/tmp/fixture.sqlite",
      facts: { frozen_identity_count: 12, frozen_identity_invalid_count: 0 },
      identitySet: ["job-1"], recordCounts: { tasks: 1 } },
    storage: { confirmedCount: 1, mutationCount: 1, storageEngine: "sqlite-wal",
      facts: { confirmed_row_invalid_count: 0 }, storagePath: "/tmp/fixture.sqlite", unresolvedCount: 0 },
    provider: { catalogHash: "sha256:fixture", pluginIds: ["fixture-plugin"],
      facts: { catalog_plugin_count: 12 }, providerName: "ChatGPT", terminalReceiptCount: 12 },
    authorization: { authorityState: "present", fenceHashes: ["sha256:fixture"],
      facts: { lease_fence_bound_job_count: 12, unbound_lease_fence_job_count: 0 },
      grantCount: 1, principalIds: ["fixture-plugin"] },
    recovery: { finalState: "completed", observedStates: ["recovery_pending", "completed"],
      facts: { completed_observed: true, recovery_pending_observed: true }, recoveryJobId: "job-1", unresolvedCount: 0 },
  } as const;
  const routes = {
    browser: { lawId: "LAW-LOCAL-BROWSER-SESSION-001-V4", clauses: ["forbidden:6"] },
    service: { lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V6", clauses: ["forbidden:17"] },
    database: { lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V6", clauses: ["forbidden:8"] },
    storage: { lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V6", clauses: ["forbidden:10"] },
    provider: { lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V6", clauses: ["forbidden:0"] },
    authorization: { lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V6", clauses: ["forbidden:3"] },
    recovery: { lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V6", clauses: ["forbidden:9"] },
  } as const;
  for (const [kind, observation] of Object.entries(observations)) {
    const evidenceMode = `dynamic.${kind}`;
    const route = routes[kind as keyof typeof routes];
    const payload = { ...base, ...route, evidenceMode, observation_kind: kind, observation };
    const binding = { ...route, evidenceMode, observedValue: base.observed_value,
      proofRunId: base.proof_run_id, candidate: base.candidate, producerScript: base.producer_script };
    assert.equal(validateDynamicReceiptPayload(payload, binding), true, kind);
    assert.equal(validateDynamicReceiptPayload({ ...payload, observation: {} }, binding), false, `${kind}:empty`);
    const originalFacts = observation.facts as Readonly<Record<string, string | number | boolean>>;
    const [firstFact] = Object.keys(originalFacts);
    const currentFact = originalFacts[firstFact!]!;
    const wrongFact = typeof currentFact === "boolean" ? !currentFact : typeof currentFact === "number"
      ? (currentFact === 0 ? 1 : 0) : `${currentFact}-wrong`;
    assert.equal(validateDynamicReceiptPayload({ ...payload,
      observation: { ...observation, facts: { ...originalFacts, [firstFact!]: wrongFact } } }, binding), false,
    `${kind}:clause-fact-mismatch`);
    assert.equal(validateDynamicReceiptPayload({ ...payload, observation_kind: kind === "browser" ? "service" : "browser" }, binding), false,
      `${kind}:mode-mismatch`);
    assert.equal(validateDynamicReceiptPayload({ ...payload, clauses: ["forbidden:1"] }, binding), false,
      `${kind}:clause-mismatch`);
    assert.equal(validateDynamicReceiptPayload({ ...payload, observed_value: "wrong" }, binding), false,
      `${kind}:value-mismatch`);
    const unsupportedClauses = ["forbidden:99"];
    assert.equal(validateDynamicReceiptPayload({ ...payload, clauses: unsupportedClauses },
      { ...binding, clauses: unsupportedClauses }), false, `${kind}:unsupported-clause-fact-mapping`);
  }
  const serviceMode = "dynamic.service";
  const serviceRoute = routes.service;
  assert.equal(validateDynamicReceiptPayload({ ...base, ...serviceRoute, evidenceMode: serviceMode,
    observation_kind: "service", observation: observations.browser }, { ...serviceRoute, evidenceMode: serviceMode,
    observedValue: base.observed_value, proofRunId: base.proof_run_id, candidate: base.candidate,
    producerScript: base.producer_script }), false,
  "a browser object cannot authenticate a service receipt");
});

test("a generic service object cannot authenticate a factually unrelated startup clause", () => {
  const route = { lawId: "LAW-STARTUP-ENTRYPOINT-002-V4", evidenceMode: "dynamic.service",
    clauses: ["forbidden:0"] };
  const producerScript = "proof:local-shell-current-runtime";
  const payload = {
    schema_version: "governance-dynamic-observation.v2", proof_run_id: "a".repeat(64),
    candidate: "b".repeat(40), captured_at: "2026-08-27T00:00:00.000Z", ...route,
    observation_kind: "service", observed_value: "generic-service", producer_script: producerScript,
    observation: {
      cleanupVerified: true, components: ["generic"], endpoint: "http://127.0.0.1:4173",
      facts: { listener_count: 1 }, processId: 4173, serviceName: "generic",
      sourceFingerprint: "sha256:generic", status: "healthy",
    },
  };
  assert.equal(validateDynamicReceiptPayload(payload, { ...route, observedValue: payload.observed_value,
    proofRunId: payload.proof_run_id, candidate: payload.candidate, producerScript }), false);
});

test("a fixed or unauthenticated stdout marker cannot mint evidence for unexecuted law routes", () => {
  const first = { ...fixtureLaw(), lawId: "LAW-GPT-001-V2", capabilityDomain: "gpt" };
  const routes = [{ law: first, mode: "exam.golden" }];
  const requests = proofRequests(routes);
  const script = "acceptance:gpt";
  assert.equal(bindNativeProofObservations("FIXED_PASS\n", routes, requests, script, "exam").size, 0);
  const oneNativeObservation = `${proofObservationPrefix}${JSON.stringify({
    ...directObservation(requests[0]!, ["forbidden:0", "summary"], [examRef(
      "lawId=LAW-GPT-001-V2;mode=exam.golden;case=provider-boundary",
    )]),
  })}\n`;
  assert.equal(bindNativeProofObservations(oneNativeObservation, routes, requests, script, "exam").size, 1);
  const missingProducerClauses = `${proofObservationPrefix}${JSON.stringify({
    ...requests[0], passed: true, refs: [examRef("case=missing-clauses")], findings: [],
  })}\n`;
  assert.throws(
    () => bindNativeProofObservations(missingProducerClauses, routes, requests, script, "exam"),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
  const invented = `${proofObservationPrefix}${JSON.stringify({
    ...directObservation(requests[0]!, ["forbidden:0", "summary"], [examRef("case=forged")]),
    proofRunId: "f".repeat(64),
  })}\n`;
  assert.throws(
    () => bindNativeProofObservations(invented, routes, requests, script, "exam"),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
});

test("native proof observations reject one locator reused across law routes", () => {
  const law = { ...fixtureLaw(), lawId: "LAW-GPT-001-V2", capabilityDomain: "gpt" };
  const routes = [{ law, mode: "exam.golden" }];
  const requests = proofRequests(routes);
  const line = `${proofObservationPrefix}${JSON.stringify({
    ...directObservation(requests[0]!, ["forbidden:0", "summary"], [examRef(
      "lawId=LAW-GPT-001-V2;mode=exam.golden;case=exact-target",
    )]),
  })}`;
  assert.throws(
    () => bindNativeProofObservations(`${line}\n${line}`, routes, requests, "acceptance:gpt", "exam"),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_DUPLICATE",
  );
  assert.throws(
    () => bindNativeProofObservations(`${proofObservationPrefix}{not-json}`, routes, requests, "acceptance:gpt", "exam"),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
});

test("a Dynamic producer cannot self-authenticate an invented native object", () => {
  const law = { ...fixtureLaw(), lawId: "LAW-LOCAL-APP-SHELL-001-V6", capabilityDomain: "local-app-shell" };
  const routes = [{ law, mode: "dynamic.service" }];
  const requests = proofRequests(routes, "dynamic");
  const marker = `${proofObservationPrefix}${JSON.stringify({
    ...directObservation(requests[0]!, fixtureDynamicClauses, [dynamicRef(
      requests[0]!, "/tmp/no-real-object", "a".repeat(64), "proof:local-shell-current-runtime",
    )]),
  })}`;
  assert.throws(
    () => bindNativeProofObservations(
      marker, routes, requests, "proof:local-shell-current-runtime", "dynamic", fixtureEvidenceDirectory,
    ),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
  const selfAuthenticatedUrl = `${proofObservationPrefix}${JSON.stringify({
    ...directObservation(requests[0]!, fixtureDynamicClauses, [dynamicRef(
      requests[0]!, "/tmp/self-authenticated-url", "a".repeat(64), "proof:local-shell-current-runtime",
    )]),
  })}`;
  assert.throws(
    () => bindNativeProofObservations(
      selfAuthenticatedUrl, routes, requests, "proof:local-shell-current-runtime", "dynamic", fixtureEvidenceDirectory,
    ),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
  const nativeFileMarker = `${proofObservationPrefix}${JSON.stringify({
    ...directObservation(requests[0]!, fixtureDynamicClauses, [dynamicRef(
      requests[0]!, fixtureEvidencePath, fixtureEvidenceDigest, "proof:local-shell-current-runtime",
    )]),
  })}`;
  assert.equal(bindNativeProofObservations(
    nativeFileMarker, routes, requests, "proof:local-shell-current-runtime", "dynamic", fixtureEvidenceDirectory,
  ).size, 1);
});

test("Dynamic receipts must be exact regular files created in this proof run directory", () => {
  const law = { ...fixtureLaw(), lawId: "LAW-LOCAL-APP-SHELL-001-V6", capabilityDomain: "local-app-shell" };
  const routes = [{ law, mode: "dynamic.service" }];
  const requests = proofRequests(routes, "dynamic");
  const outsideDirectory = mkdtempSync(resolve(tmpdir(), "quality-outside-evidence-"));
  const outsidePath = resolve(outsideDirectory, "receipt.json");
  writeFileSync(outsidePath, readFileSync(fixtureEvidencePath));
  const lineFor = (locator: string, receipt: string): string => `${proofObservationPrefix}${JSON.stringify({
    ...directObservation(requests[0]!, fixtureDynamicClauses, [dynamicRef(
      requests[0]!, locator, receipt, "proof:local-shell-current-runtime",
    )]),
  })}`;
  assert.throws(
    () => bindNativeProofObservations(lineFor(outsidePath, fixtureEvidenceDigest), routes, requests,
      "proof:local-shell-current-runtime", "dynamic", fixtureEvidenceDirectory),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );

  const nestedDirectory = resolve(fixtureEvidenceDirectory, "recursive-hit");
  mkdirSync(nestedDirectory);
  writeFileSync(resolve(nestedDirectory, "receipt.txt"), fixtureEvidenceDigest);
  assert.throws(
    () => bindNativeProofObservations(lineFor(nestedDirectory, fixtureEvidenceDigest), routes, requests,
      "proof:local-shell-current-runtime", "dynamic", fixtureEvidenceDirectory),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );

  const symlinkPath = resolve(fixtureEvidenceDirectory, "receipt-link.json");
  symlinkSync(fixtureEvidencePath, symlinkPath);
  assert.throws(
    () => bindNativeProofObservations(lineFor(symlinkPath, fixtureEvidenceDigest), routes, requests,
      "proof:local-shell-current-runtime", "dynamic", fixtureEvidenceDirectory),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
});

test("Dynamic routes cannot substitute one mode-bound receipt locator or emit summary-only clauses", () => {
  const law = { ...fixtureLaw(), lawId: "LAW-LOCAL-APP-SHELL-001-V6", capabilityDomain: "local-app-shell" };
  const routes = [{ law, mode: "dynamic.service" }, { law, mode: "dynamic.browser" }];
  const requests = proofRequests(routes, "dynamic");
  const output = requests.map((request) => `${proofObservationPrefix}${JSON.stringify({
    ...directObservation(request, fixtureDynamicClauses, [dynamicRef(
      request, fixtureEvidencePath, fixtureEvidenceDigest, "proof:local-shell-current-runtime",
    )]),
  })}`).join("\n");
  assert.throws(
    () => bindNativeProofObservations(output, routes, requests, "proof:local-shell-current-runtime",
      "dynamic", fixtureEvidenceDirectory),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
  const summaryOnly = `${proofObservationPrefix}${JSON.stringify({
    ...directObservation(requests[0]!, ["summary"], [dynamicRef(
      requests[0]!, fixtureEvidencePath, fixtureEvidenceDigest, "proof:local-shell-current-runtime",
    )]),
  })}`;
  assert.throws(
    () => bindNativeProofObservations(summaryOnly, [routes[0]!], [requests[0]!],
      "proof:local-shell-current-runtime", "dynamic", fixtureEvidenceDirectory),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
});

test("static validation rejects a law with no owner result", () => {
  const context = {
    project: new Project({ tsConfigFilePath: "tsconfig.json" }),
    selectedLawId: "LAW-FIXTURE-001-V1",
    sealedRoot: process.cwd(),
    targetSet: { queryRef: "scope:fixture", count: 1 },
    targetPaths: ["package.json"],
    lawRequirements: ["LAW-FIXTURE-001-V1", "LAW-FIXTURE-002-V1"].map((lawId) => ({
      lawId,
      forbiddenCount: 1,
      requiredStaticModes: ["static.ast"],
      targetPaths: ["package.json"],
      targetSet: { queryRef: `scope:${lawId}`, count: 1 },
    })),
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: "scripts/audit/shared/static-inspection-contract.ts" },
  } as unknown as InspectorContext;
  assert.throws(
    () => validateStaticInspection(context, {
      capabilityDomain: "fixture", reportedLawIds: ["LAW-FIXTURE-001-V1", "LAW-FIXTURE-002-V1"],
      lawResults: [{ lawId: "LAW-FIXTURE-001-V1", assertions: [{ clauses: staticClauses(0),
        evidenceMode: "static.ast", passed: true, refs: staticEvidenceRefs(context, "LAW-FIXTURE-001-V1", "static.ast", staticClauses(0), staticReceipt("LAW-FIXTURE-001-V1", "requirementFor"), ["requirementFor"], staticNativeRef("LAW-FIXTURE-001-V1", "static.ast", staticClauses(0), "requirementFor")) }], findings: [] }],
      inspectedFiles: ["package.json"],
    }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE",
  );
});

test("static validation rejects a producer clause outside the active law denominator", () => {
  const context = {
    project: new Project({ tsConfigFilePath: "tsconfig.json" }), sealedRoot: process.cwd(),
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: "scripts/audit/shared/static-inspection-contract.ts" },
    lawRequirements: [{
      lawId: "LAW-FIXTURE-001-V1",
      forbiddenCount: 1,
      requiredStaticModes: ["static.ast"],
      targetPaths: ["package.json"],
      targetSet: { queryRef: "scope:fixture", count: 1 },
    }],
  } as unknown as InspectorContext;
  assert.throws(
    () => validateStaticInspection(context, {
      capabilityDomain: "fixture", reportedLawIds: ["LAW-FIXTURE-001-V1"],
      lawResults: [{ lawId: "LAW-FIXTURE-001-V1", assertions: [{ clauses: staticClauses(1),
        evidenceMode: "static.ast", passed: true, refs: staticEvidenceRefs(context, "LAW-FIXTURE-001-V1", "static.ast", staticClauses(1), staticReceipt("LAW-FIXTURE-001-V1", "requirementFor"), ["requirementFor"], staticNativeRef("LAW-FIXTURE-001-V1", "static.ast", staticClauses(1), "requirementFor")) }], findings: [] }],
      inspectedFiles: ["package.json"],
    }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE",
  );
  assert.throws(
    () => validateStaticInspection(context, {
      capabilityDomain: "fixture", reportedLawIds: ["LAW-FIXTURE-001-V1"],
      lawResults: [{ lawId: "LAW-FIXTURE-001-V1", assertions: [{ clauses: staticClauses(),
        evidenceMode: "static.ast", passed: true,
        refs: staticEvidenceRefs(context, "LAW-FIXTURE-001-V1", "static.ast", staticClauses(), staticReceipt("LAW-FIXTURE-001-V1", "requirementFor"), ["requirementFor"], staticNativeRef("LAW-FIXTURE-001-V1", "static.ast", staticClauses(), "requirementFor")) }], findings: [] }],
      inspectedFiles: ["package.json"],
    }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE",
  );
});

test("static validation rejects an unreadable complete target set", () => {
  const context = {
    project: new Project({ useInMemoryFileSystem: true }), sealedRoot: "/sealed",
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: "scripts/audit/domains/fixture/inspector.ts" },
    lawRequirements: [{
      lawId: "LAW-FIXTURE-001-V1",
      forbiddenCount: 1,
      requiredStaticModes: ["static.ast"],
      targetPaths: ["src/fixture-a.ts", "src/fixture-b.ts"],
      targetSet: { queryRef: "scope:LAW-FIXTURE-001-V1#appliesTo-minus-excludes", count: 2 },
    }],
  } as unknown as InspectorContext;
  assert.throws(
    () => validateStaticInspection(context, {
      capabilityDomain: "fixture", reportedLawIds: ["LAW-FIXTURE-001-V1"], lawResults: [],
      inspectedFiles: ["src/fixture-a.ts"],
    }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE",
  );
});

test("static PASS evidence names the native target object, producer result, and complete target scope", () => {
  const targetPath = "scripts/audit/shared/quality-contract.ts";
  const context = {
    sealedRoot: process.cwd(),
    project: new Project({ tsConfigFilePath: "tsconfig.json" }),
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: "scripts/audit/shared/static-inspection-contract.ts" },
    lawRequirements: [{
      lawId: "LAW-FIXTURE-001-V1", forbiddenCount: 1,
      requiredStaticModes: ["static.ast"],
      targetPaths: [targetPath],
      targetSet: { queryRef: "scope:LAW-FIXTURE-001-V1#appliesTo-minus-excludes", count: 1 },
    }],
  } as unknown as InspectorContext;
  const refs = staticEvidenceRefs(context, "LAW-FIXTURE-001-V1", "static.ast", staticClauses(0), staticReceipt("LAW-FIXTURE-001-V1", "requirementFor"), ["requirementFor"], staticNativeRef("LAW-FIXTURE-001-V1", "static.ast", staticClauses(0), "requirementFor", targetPath));
  const output = validateStaticInspection(context, { capabilityDomain: "fixture", reportedLawIds: ["LAW-FIXTURE-001-V1"],
    lawResults: [{ lawId: "LAW-FIXTURE-001-V1", assertions: [{ clauses: staticClauses(0), evidenceMode: "static.ast",
      passed: true, refs }], findings: [] }], inspectedFiles: [targetPath] });
  const validatedRefs = output.lawResults[0]!.assertions[0]!.refs;
  assert.equal(validatedRefs.some((ref) => ref.startsWith(`ast:${targetPath}#`)), true);
  assert.equal(validatedRefs.some((ref) => ref.includes("semanticChecks%3DrequirementFor")), true);
  assert.equal(validatedRefs.some((ref) => ref.includes("executionResult%3Dpassed")), true);
  assert.equal(validatedRefs.some((ref) => ref.includes("clauses%3Dforbidden%3A0%2Csummary")), true);
});

test("static evidence keeps the exact scope when a governed path is not an evidence locator", () => {
  const pathWithReservedCharacter = "docs/history/legacy-root/grasseye-local-workbench@0.1.0";
  const targetPath = "scripts/audit/shared/quality-contract.ts";
  const context = {
    sealedRoot: process.cwd(),
    project: new Project({ tsConfigFilePath: "tsconfig.json" }),
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: "scripts/audit/shared/static-inspection-contract.ts" },
    lawRequirements: [{
      lawId: "LAW-FIXTURE-001-V1", forbiddenCount: 1,
      requiredStaticModes: ["static.ast"],
      targetPaths: [pathWithReservedCharacter, targetPath],
      targetSet: { queryRef: "scope:LAW-FIXTURE-001-V1#appliesTo-minus-excludes", count: 2 },
    }],
  } as unknown as InspectorContext;
  const refs = staticEvidenceRefs(context, "LAW-FIXTURE-001-V1", "static.ast", staticClauses(0), staticReceipt("LAW-FIXTURE-001-V1", "requirementFor"), ["requirementFor"], staticNativeRef("LAW-FIXTURE-001-V1", "static.ast", staticClauses(0), "requirementFor", targetPath));
  const output = validateStaticInspection(context, { capabilityDomain: "fixture", reportedLawIds: ["LAW-FIXTURE-001-V1"],
    lawResults: [{ lawId: "LAW-FIXTURE-001-V1", assertions: [{ clauses: staticClauses(0), evidenceMode: "static.ast",
      passed: true, refs }], findings: [] }], inspectedFiles: [pathWithReservedCharacter, targetPath] });
  const validatedRefs = output.lawResults[0]!.assertions[0]!.refs;
  assert.equal(validatedRefs.includes("scope:LAW-FIXTURE-001-V1#appliesTo-minus-excludes"), true);
  assert.equal(validatedRefs.some((ref) => ref.includes(pathWithReservedCharacter)), false);
});

test("a zero-target pure absence check emits only its exact scope evidence", () => {
  const lawId = "LAW-FIXTURE-001-V1";
  const context = {
    sealedRoot: process.cwd(), project: new Project({ tsConfigFilePath: "tsconfig.json" }),
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: "scripts/audit/shared/static-inspection-contract.ts" },
    lawRequirements: [{ lawId, forbiddenCount: 1, requiredStaticModes: ["static.filesystem"], targetPaths: [],
      targetSet: { queryRef: `scope:${lawId}#appliesTo-minus-excludes`, count: 0 } }],
  } as unknown as InspectorContext;
  const receipts = staticReceipt(lawId, "inspectRetiredSurfaceAbsence");
  const refs = staticEvidenceRefs(context, lawId, "static.filesystem", staticClauses(0), receipts,
    ["inspectRetiredSurfaceAbsence"], "scope-only");
  assert.deepEqual(refs, [`scope:${lawId}#appliesTo-minus-excludes`]);
  assert.doesNotThrow(() => validateStaticInspection(context, {
    capabilityDomain: "fixture", reportedLawIds: [lawId], inspectedFiles: [],
    lawResults: [{ lawId, assertions: [{ clauses: staticClauses(0), evidenceMode: "static.filesystem",
      passed: true, refs }], findings: [] }],
  }));
  const law = { ...fixtureLaw(), evidenceModes: ["static.filesystem"], appliesTo: ["retired/**"] };
  assert.equal(buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [{
    lawId, findings: [], assertions: [{ clauses: staticClauses(0), evidenceMode: "static.filesystem",
      passed: true, refs }],
  }] }).outcome, "PASS");
  assert.throws(() => staticEvidenceRefs(context, lawId, "static.filesystem", staticClauses(0), receipts,
    ["inspectRetiredSurfaceAbsence"], []),
  (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE");
});

test("a producer verdict is derived from its executed semantic-check receipt", () => {
  const lawId = "LAW-FIXTURE-001-V1";
  const receipts = [...staticReceipt(lawId, "inspectTypes", false), ...staticReceipt(lawId, "inspectAst")];
  assert.equal(producerModePassed(receipts, lawId, ["inspectTypes"]), false);
  assert.equal(producerModePassed(receipts, lawId, ["inspectAst"]), true);
  assert.equal(producerModePassed(receipts, lawId, ["missingCheck"]), false);
  assert.equal(producerModePassed([...receipts, ...staticReceipt(lawId, "inspectAst", false)], lawId, ["inspectAst"]), false);
});

test("each static mode records a mode-native semantic-check selector", () => {
  const lawId = "LAW-FIXTURE-001-V1";
  const targetPaths = [
    "scripts/audit/shared/quality-contract.ts",
    "scripts/audit/shared/quality-runner.ts",
    "package.json",
    "pnpm-workspace.yaml",
  ];
  const context = {
    sealedRoot: process.cwd(), project: new Project({ tsConfigFilePath: "tsconfig.json" }),
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: "scripts/audit/shared/static-inspection-contract.ts" },
    lawRequirements: [{ lawId, forbiddenCount: 1,
      requiredStaticModes: ["static.ast", "static.types", "static.contract", "static.dependency", "static.config", "static.json", "static.yaml"],
      targetPaths, targetSet: { queryRef: `scope:${lawId}#appliesTo-minus-excludes`, count: targetPaths.length } }],
  } as unknown as InspectorContext;
  const nativePath = (mode: string): string => mode === "static.yaml" ? "pnpm-workspace.yaml"
    : ["static.contract", "static.config", "static.json"].includes(mode) ? "package.json"
      : "scripts/audit/shared/quality-contract.ts";
  const modeSelector = (mode: string): string[] => staticEvidenceRefs(context, lawId, mode, staticClauses(0), staticReceipt(lawId, "requirementFor"), ["requirementFor"], staticNativeRef(lawId, mode, staticClauses(0), "requirementFor", nativePath(mode)))
    .filter((ref) => !ref.startsWith("scope:"));
  assert.equal(modeSelector("static.ast").some((ref) => ref.includes("semanticChecks%3DrequirementFor")), true);
  for (const mode of context.lawRequirements[0]!.requiredStaticModes) {
    assert.equal(modeSelector(mode).some((ref) =>
      ref.includes(encodeURIComponent(`lawId=${lawId};mode=${mode};`))), true);
  }
  assert.equal(modeSelector("static.types").every((ref) => ref.startsWith("test:")), true);
  assert.equal(modeSelector("static.contract").every((ref) => ref.startsWith("config:")), true);
  assert.equal(modeSelector("static.dependency").every((ref) => ref.startsWith("dependency:")), true);
  assert.equal(modeSelector("static.config").every((ref) => ref.startsWith("config:")), true);
  assert.equal(modeSelector("static.json").every((ref) => ref.startsWith("json:")), true);
  assert.equal(modeSelector("static.yaml").every((ref) => ref.startsWith("yaml:")), true);
});

test("two-mode and partial multi-mode semantic-check substitution fail closed", () => {
  const lawId = "LAW-FIXTURE-001-V1";
  const targetPath = "scripts/audit/shared/static-inspection-contract.ts";
  const context = {
    sealedRoot: process.cwd(), project: new Project({ tsConfigFilePath: "tsconfig.json" }),
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: targetPath },
    lawRequirements: [{ lawId, forbiddenCount: 1,
      requiredStaticModes: ["static.filesystem", "static.ast", "static.types", "static.dependency"],
      targetPaths: [targetPath], targetSet: { queryRef: `scope:${lawId}#appliesTo-minus-excludes`, count: 1 } }],
  } as unknown as InspectorContext;
  const assertion = (mode: "static.filesystem" | "static.ast" | "static.types" | "static.dependency", check: string) =>
    ({ clauses: staticClauses(0), evidenceMode: mode,
    passed: true, refs: staticEvidenceRefs(context, lawId, mode, staticClauses(0), staticReceipt(lawId, check),
      [check], staticNativeRef(lawId, mode, staticClauses(0), check, targetPath)) });
  const reject = (checks: readonly [string, string, string, string]) => assert.throws(
    () => validateStaticInspection(context, { capabilityDomain: "fixture", reportedLawIds: [lawId],
      lawResults: [{ lawId, assertions: [assertion("static.filesystem", checks[0]), assertion("static.ast", checks[1]),
        assertion("static.types", checks[2]), assertion("static.dependency", checks[3])], findings: [] }],
      inspectedFiles: [targetPath] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE",
  );
  reject(["inspectSharedPair", "inspectSharedPair", "inspectTypes", "inspectDependencies"]);
  reject(["inspectPartialGroup", "inspectPartialGroup", "inspectPartialGroup", "inspectDependencies"]);
});

test("a dead or unexecuted producer semantic check cannot mint static evidence", () => {
  const project = new Project({ useInMemoryFileSystem: true });
  const ownerPath = "scripts/audit/domains/fixture/inspector.ts";
  const owner = project.createSourceFile(`/sealed/${ownerPath}`, "inspectSemanticContract();\n");
  const lawId = "LAW-FIXTURE-001-V1";
  const context = {
    sealedRoot: "/sealed", project,
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: ownerPath },
    lawRequirements: [{ lawId, forbiddenCount: 1, requiredStaticModes: ["static.ast"], targetPaths: ["src/fixture.ts"],
      targetSet: { queryRef: `scope:${lawId}#appliesTo-minus-excludes`, count: 1 } }],
  } as unknown as InspectorContext;
  const findings: import("../../scripts/audit/shared/inspector-contracts.js").InspectorFinding[] = [];
  const receipts: import("../../scripts/audit/shared/inspector-contracts.js").StaticCheckReceipt[] = [];
  let executionCount = 0;
  const inspectSemanticContract = (): void => { executionCount += 1; };
  recordStaticCheck({ check: "inspectSemanticContract", findings, lawIds: [lawId], receipts, run: () => inspectSemanticContract() });
  assert.equal(executionCount, 1);
  assert.equal(staticEvidenceRefs(context, lawId, "static.ast", staticClauses(0), receipts, ["inspectSemanticContract"], staticNativeRef(lawId, "static.ast", staticClauses(0), "inspectSemanticContract", "src/fixture.ts")).length, 2);
  assert.throws(() => recordStaticCheck({ check: "inspectSemanticContract", findings, lawIds: [lawId], receipts: [], run: () => undefined }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE");
  owner.replaceWithText("if (false) { inspectSemanticContract(); }\n");
  assert.throws(
    () => staticEvidenceRefs(context, lawId, "static.ast", staticClauses(0), [], ["inspectSemanticContract"], staticNativeRef(lawId, "static.ast", staticClauses(0), "inspectSemanticContract", "src/fixture.ts")),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE",
  );
  assert.throws(
    () => staticEvidenceRefs(context, lawId, "static.ast", staticClauses(0), receipts, ["inspectSemanticContract"],
      staticNativeRef(lawId, "static.ast", staticClauses(0), "inspectSemanticContract", "src/fixture.ts", false)),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE",
  );
  assert.throws(
    () => staticEvidenceRefs(context, lawId, "static.ast", staticClauses(0), receipts, ["inspectSemanticContract"],
      staticNativeRef(lawId, "static.ast", staticClauses(0), "inspectSemanticContract", "src/not-governed.ts")),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE",
  );
});

test("the active evidence-ownership blueprint rejects central clauses and mode substitution", () => {
  const routes = readFileSync("scripts/audit/shared/quality-routes.ts", "utf8");
  const proofContract = readFileSync("scripts/audit/shared/proof-observation.ts", "utf8");
  const staticContract = readFileSync("scripts/audit/shared/static-inspection-contract.ts", "utf8");
  const qualityContract = readFileSync("scripts/audit/shared/quality-contract.ts", "utf8");
  assert.equal(/proofClauses|clausesForEvidenceMode/u.test(routes), false);
  for (const field of ["clauses", "passed", "refs", "findings"]) assert.equal(proofContract.includes(`${field}:`), true);
  assert.equal(staticContract.includes("executionResult="), true);
  assert.equal(staticContract.includes("requirement.targetPaths.includes(objectPath)"), true);
  assert.equal(qualityContract.includes('"static.types": "test"'), true);
  assert.equal(qualityContract.includes('"static.types": "ast"'), false);
  const agent = readFileSync("scripts/audit/domains/agent-production-runtime/inspector.ts", "utf8");
  const gpt = readFileSync("scripts/audit/domains/gpt/inspector.ts", "utf8");
  const capability = readFileSync("scripts/audit/domains/capability-governance/inspector.ts", "utf8");
  const directProof = readFileSync("scripts/acceptance/agent-production-runtime.real-proof.ts", "utf8");
  const uniqueModeChecks = (source: string): boolean => {
    const body = /const MODE_CHECKS = \{([\s\S]*?)\} as const;/u.exec(source)?.[1] ?? "";
    const checks = [...body.matchAll(/"static\.[a-z]+": \["([A-Za-z]+)"\]/gu)].map((match) => match[1]!);
    return checks.length === 5 && new Set(checks).size === 5;
  };
  assert.equal(uniqueModeChecks(agent), true);
  assert.equal(uniqueModeChecks(gpt), true);
  assert.equal(uniqueModeChecks(agent.replace('"static.types": ["inspectAgentTypes"]',
    '"static.types": ["inspectAgentProductionRuntime"]')), false);
  assert.equal(capability.includes('mode === "static.types" ? ["inspectCapabilityFacadeTypes"]'), true);
  assert.equal(capability.replace('mode === "static.types" ? ["inspectCapabilityFacadeTypes"]',
    'mode === "static.types" ? ["pushMissingFacadeExportConsumers"]')
    .includes('mode === "static.types" ? ["inspectCapabilityFacadeTypes"]'), false);
  assert.equal(directProof.includes("observation_kind: evidenceMode.slice"), true);
  assert.equal(directProof.includes("observation: observationForMode(evidenceMode as DynamicMode)"), true);
  assert.equal(directProof.includes("lawId, evidenceMode, observation })"), false);
  assert.equal(proofContract.includes("validateDynamicReceiptPayload"), true);
  assert.equal(proofContract.includes("dynamicReceiptFileValid"), true);
});

test("unsupported evidence kinds and projection identity drift fail closed", () => {
  assert.equal(validEvidenceRef("types:scripts/audit/shared/quality-contract.ts#symbol%3DFixture"), false);
  assert.throws(
    () => assertProjectionStable("a".repeat(40), "[]", "b".repeat(40), "[]"),
    (error: unknown) => error instanceof GovernanceError && error.code === "CANDIDATE_DRIFT",
  );
  assert.throws(
    () => assertProjectionStable("a".repeat(40), "[]", "a".repeat(40), "[[\"M\",\"x\"]]"),
    (error: unknown) => error instanceof GovernanceError && error.code === "CANDIDATE_DRIFT",
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
  const lawDomains = new Map([["LAW-AI-ACCEPTANCE-001-V1", "ai-acceptance"]]);
  const valid = {
    schemaVersion: 1, specId: "ai-acceptance.xuanxue-report-provider", status: "active", version: 3,
    owner: "ai-acceptance", lawIds: ["LAW-AI-ACCEPTANCE-001-V1"], specKind: "cross-repo-contract",
    contract: {
      contractId: "xuanxue.report", version: 3, providerRepo: "ADVISION-X/xuanxue-web",
      providerDomain: "ai-acceptance", authorityArtifact: { path: "artifacts/report.json", selector: "version=3" },
    },
  };
  assert.doesNotThrow(() => validateProviderContractSpec(valid, "ADVISION-X/xuanxue-web", lawDomains, () => true));
  for (const malformed of [
    { ...valid, unexpected: true },
    { ...valid, lawIds: ["LAW-NONEXISTENT-999-V1"] },
    { ...valid, owner: "wrong-domain" },
    { ...valid, contract: { ...valid.contract, providerDomain: "wrong-domain" } },
    { ...valid, contract: { ...valid.contract, contractId: "" } },
    { ...valid, contract: { ...valid.contract, authorityArtifact: null } },
    { ...valid, contract: { ...valid.contract, authorityArtifact: { ...valid.contract.authorityArtifact, unknown: true } } },
  ]) assert.throws(
    () => validateProviderContractSpec(malformed, "ADVISION-X/xuanxue-web", lawDomains, () => true),
    (error: unknown) => error instanceof GovernanceError && error.code === "EXTERNAL_SURFACE_AUTHORITY_MISSING",
  );
  const current = JSON.parse(readFileSync(
    "docs/specs/agent-production-runtime/agent-plugin-capability-manifest.provider.spec.json", "utf8",
  )) as unknown;
  assert.doesNotThrow(() => validateProviderContractSpec(current, "ADVISION-X/AGENT",
    new Map([["LAW-AGENT-PRODUCTION-RUNTIME-001-V6", "agent-production-runtime"]]),
    (path) => path === "src/lib/local-runtime/production/catalog.ts"));
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

test("repository path bytes and governance-source walks fail closed", () => {
  assert.deepEqual(decodeGitPathBytes(Buffer.from("docs/specs/law.md\0")), ["docs/specs/law.md"]);
  assert.throws(
    () => decodeGitPathBytes(Buffer.from([0x62, 0x61, 0x64, 0xff, 0x00])),
    (error: unknown) => error instanceof GovernanceError && error.code === "SOURCE_PARSE_FAILED",
  );
  assert.throws(
    () => decodeGitPathBytes(Buffer.from("docs/specs/cafe\u0301.md\0")),
    (error: unknown) => error instanceof GovernanceError && error.code === "SOURCE_PARSE_FAILED",
  );
  const root = mkdtempSync(resolve(tmpdir(), "governance-source-symlink-"));
  mkdirSync(resolve(root, "docs", "specs"), { recursive: true });
  const outside = resolve(root, "..", `outside-governance-${process.pid}.json`);
  writeFileSync(outside, "{}\n");
  symlinkSync(outside, resolve(root, "docs", "specs", "escaped.json"));
  assert.throws(
    () => walkAt(root, "docs/specs"),
    (error: unknown) => error instanceof GovernanceError && error.code === "TARGET_OUTSIDE_DOMAIN_AUTHORITY",
  );
});

test("production Dynamic Proof cleanup attempts every resource and fails closed", async () => {
  assert.deepEqual(await observeProductionProofCleanup(async () => true, async () => true), {
    browserContextClosed: true, cleanupVerified: true, workbenchStopped: true,
  });
  const calls: string[] = [];
  await assert.rejects(
    observeProductionProofCleanup(
      async () => { calls.push("workbench"); throw new Error("injected workbench cleanup failure"); },
      async () => { calls.push("browser"); return true; },
    ),
    (error: unknown) => error instanceof AggregateError
      && error.message === "AGENT_PRODUCTION_DYNAMIC_PROOF_CLEANUP_FAILED",
  );
  assert.deepEqual(calls, ["workbench", "browser"]);
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

test("active mutation inspectors use one DISPATCHED chain inside each law scope", () => {
  const registry = buildRegistry();
  const agentLaw = registry.laws.find((law) => law.lawId === "LAW-AGENT-PRODUCTION-RUNTIME-001-V6");
  assert.ok(agentLaw);
  const agentTargets = computeTargetPaths(agentLaw, registry);
  const crossOwnerPaths = [
    "src/lib/browser/exact-target/browser-command-actor.ts",
    "src/lib/browser/exact-target/browser-mutation-store.ts",
  ];
  for (const path of crossOwnerPaths) assert.equal(agentTargets.includes(path), false, path);

  const agentInspector = readFileSync("scripts/audit/domains/agent-production-runtime/inspector.ts", "utf8");
  for (const path of crossOwnerPaths) assert.equal(agentInspector.includes(path), false, path);
  for (const token of [
    "logical-mutation-boundary", "runAtomicStep({", "pluginStepId: input.stepId",
    "childCapabilityId: input.intent.childCapabilityId", "committedMutation === \\\"dispatched\\\"",
  ]) assert.equal(agentInspector.includes(token), true, token);

  const browserInspector = readFileSync(
    "scripts/audit/domains/local-browser-session/mutation-atomicity-inspection.ts", "utf8",
  );
  const runtimeInspector = readFileSync("scripts/audit/domains/runtime-log-spine/inspector.ts", "utf8");
  const activeInspectors = `${browserInspector}\n${runtimeInspector}`;
  for (const retired of [
    "markSent", "markUnknown", "unknownForBinding", "readUnknown", "BROWSER_OUTCOME_UNKNOWN",
    "current: \\\"SENT\\\"", "current: \\\"UNKNOWN\\\"",
  ]) assert.equal(runtimeInspector.includes(retired), false, retired);
  for (const retiredGuard of ["retiredIdentifiers", "retiredLiterals", "retired-mutation-chain"]) {
    assert.equal(browserInspector.includes(retiredGuard), true, retiredGuard);
  }
  for (const current of [
    "markDispatched", "markReceiptMissing", "dispatchedForBinding", "readDispatched",
    "logicalMutationId", "positivePostconditionHash", "current: \\\"DISPATCHED\\\"",
  ]) assert.equal(activeInspectors.includes(current), true, current);
});

test("active Browser and Runtime Log inspectors reject semantic decoys", () => {
  const inspectSource = (path: string, source: string) => {
    const project = new Project({ useInMemoryFileSystem: true });
    return project.createSourceFile(path, source);
  };
  const domPath = "src/lib/browser/chrome-extension/dom-intent-runtime.ts";
  const dom = readFileSync(domPath, "utf8");
  assert.equal(exactTextMatcherIsStrict(inspectSource(domPath, dom)), true);
  for (const mutant of [
    dom.replace("exact ? expectedText.trim() : expectedText", "exact ? expectedText : expectedText"),
    dom.replace("exact ? actual.trim() !== expected : !actual.includes(expected)",
      "exact ? !actual.includes(expected) : !actual.includes(expected)"),
    dom.replace("actual.trim() !== expected", "actual.trim() != expected"),
  ]) assert.equal(exactTextMatcherIsStrict(inspectSource(domPath, mutant)), false);

  const loggerPath = "src/lib/runtime-logs/logger.ts";
  const logger = readFileSync(loggerPath, "utf8");
  assert.equal(redactHashWriteOrderIsExact(inspectSource(loggerPath, logger)), true);
  const redactionDecoy = logger
    .replace("const unsigned = redactedUnsigned(unsignedInput);", "const unsigned = unsignedInput;")
    .replace("if (fileSink) fileSink.write(event as RuntimeLogEventV2);",
      "redactedUnsigned(unsignedInput);\n      if (fileSink) fileSink.write(event as RuntimeLogEventV2);");
  assert.equal(redactHashWriteOrderIsExact(inspectSource(loggerPath, redactionDecoy)), false);
});

test("every declared dynamic evidence mode has one executable RELEASE proof route", () => {
  const registry = buildRegistry();
  for (const law of registry.laws) for (const mode of law.evidenceModes.filter((item) => item.startsWith("dynamic."))) {
    assert.ok(dynamicScriptFor(law.capabilityDomain, mode).length > 0, `${law.lawId}:${mode}`);
  }
});

test("production Dynamic Proof directly observes real Chrome, runtime stores, provider and recovery", () => {
  const proof = readFileSync("scripts/acceptance/agent-production-runtime.real-proof.ts", "utf8");
  assert.equal(proof.includes("proofDurationMs"), false);
  assert.equal(proof.includes('evidenceMode: "dynamic.performance"'), false);
  for (const forbidden of [
    "GRASSEYE_GPT_DYNAMIC_PROOF_PATH", "agent-production-runtime-gpt-dynamic-proof.v1",
    "same_job_id", "zero_replayed_mutations", "checkpoint_before_hash", "candidate_hash",
    ".catch(() => undefined)", "cleanupVerified: true",
  ]) assert.equal(proof.includes(forbidden), false, forbidden);
  for (const token of [
    "chromium.launchPersistentContext", "readProductionTaskStatus", "production-runtime.sqlite",
    "browser-mutations.sqlite", "GOVERNANCE_PROOF_RECEIPT_DIR", "GRASSEYE_PRODUCTION_PROOF_JOB_IDS",
    "agentPluginCapabilityManifest", "BROWSER_ACTION_COMPLETED", "recovery_pending",
    "target=claimed", "target=absent", "gpt-child-proof:", "sent provider terminal receipt",
  ]) assert.ok(proof.includes(token), token);
  assert.equal(existsSync("scripts/acceptance/local-browser.real-chrome.ts"), false);
  assert.equal(existsSync("scripts/acceptance/local-browser-real-chrome-auto-pairing.acceptance.ts"), false);
  assert.equal(dynamicScriptFor("local-browser-session", "dynamic.browser"),
    "acceptance:agent-production-runtime:real-proof");
  assert.equal(dynamicScriptFor("local-browser-session", "dynamic.storage"),
    "acceptance:agent-production-runtime:real-proof");
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
  for (const governedPath of [
    "src/lib/browser/chrome-extension/extension-target-authority.ts",
    "docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md",
  ]) {
    assert.equal(relevantExamScripts([governedPath], registry).includes("acceptance:local-browser-terminal"), true,
      `${governedPath} must retain the automatic-claim regression route`);
  }
});
