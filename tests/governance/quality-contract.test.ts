import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { Node, Project, SyntaxKind, type Node as MorphNode, type SourceFile } from "ts-morph";

import { assertProjectionEqual, blueprintValid, buildRegistry, parseLawSource } from "../../scripts/audit/governance-authority.js";
import { assertBlueprintMarkdownContractAuthority } from "../../scripts/audit/governance-json.js";
import type { Law } from "../../scripts/audit/governance-contract.js";
import { addedSourceAt, assertProjectionStable } from "../../scripts/audit/governance.js";
import { validateLocalSpecContract } from "../../scripts/audit/governance-local-spec-contract.js";
import { BASE } from "../../scripts/audit/shared/governance-paths.js";
import {
  decodeGitPathBytes,
  GovernanceError,
  sha,
  validateGitIndexEntries,
  validateRepositoryEntryAt,
  walkAt,
} from "../../scripts/audit/governance-runtime.js";
import {
  buildQualityReport,
  deferredModes,
  requiredModes,
  validEvidenceRef,
  type LawExecutionResult,
} from "../../scripts/audit/shared/quality-contract.js";
import { assertCandidateStable, bindNativeProofObservations, computeTargetPaths, dynamicScriptFor, parseInspectorOutput } from "../../scripts/audit/shared/quality-runner.js";
import { assertExactProviderContract, assertParticipantCommitIdentity } from "../../scripts/audit/shared/quality-participant-binding.js";
import { mapWithConcurrency } from "../../scripts/audit/shared/quality-process-execution.js";
import { sealedSnapshotDigest } from "../../scripts/audit/shared/sealed-target-snapshot.js";
import { validateProviderContractSpec } from "../../scripts/audit/shared/provider-contract-authority.js";
import type { InspectorContext } from "../../scripts/audit/shared/inspector-contracts.js";
import { producerClaimRoutesFor, proofObservationPrefix, validateDynamicReceiptPayload, validateExamReceiptPayload } from "../../scripts/audit/shared/proof-observation.js";
import type { QualityProofRequest } from "../../scripts/audit/shared/proof-observation.js";
import { retiredAuthorityExamContractViolations } from "../../scripts/audit/domains/app-shell-ui/inspector-retired-authority-absence.js";
import { relevantExamScripts } from "../../scripts/audit/shared/quality-routes.js";
import { producerModePassed, recordStaticCheck, staticClauses, staticEvidenceRefs, staticImplementationDigest, validateStaticInspection } from "../../scripts/audit/shared/static-inspection-contract.js";
import { containsPageMutation, gptPrivateInfrastructureViolations } from "../../scripts/audit/domains/gpt/gpt-inspection-support.js";
import { providerWaitReasonProjectionIsFrozen, textResponseTwoGateSettlementIsFrozen } from "../../scripts/audit/domains/gpt/gpt-frozen-attempt-inspection.js";
import { browserMutationSchemaMigrationIsCurrent } from "../../scripts/audit/domains/local-browser-session/browser-mutation-settlement-inspection.js";
import { exactAssistantTurnReadIsAtomic } from "../../scripts/audit/domains/local-browser-session/dom-mechanical-facts-inspection.js";
import { requireSource } from "../../scripts/audit/domains/local-browser-session/inspector-support.js";
import { redactHashWriteOrderIsExact } from "../../scripts/audit/domains/runtime-log-spine/inspector.js";
import { astExpressionPath, astIdentifierName } from "../../scripts/audit/shared/ast-node-identity.js";

const zeroArgumentMethodCall = (node: MorphNode, ownerPath: string, method: string): boolean => {
  if (!Node.isCallExpression(node) || node.getArguments().length !== 0) return false;
  const expression = node.getExpression();
  return Node.isPropertyAccessExpression(expression) && expression.getName() === method
    && astExpressionPath(expression.getExpression()) === ownerPath;
};

const exactTextMatcherIsStrict = (domRuntime: SourceFile): boolean => {
  const matcher = domRuntime.getVariableDeclaration("queryCandidateSet")?.getInitializer();
  const loop = matcher?.getDescendantsOfKind(SyntaxKind.ForOfStatement).find((statement) => {
    const expression = statement.getExpression();
    return Node.isCallExpression(expression) && expression.getArguments().length === 0
      && astExpressionPath(expression.getExpression()) === "rawNodeIds.entries";
  });
  const loopBody = loop?.getStatement();
  if (!Node.isBlock(loopBody)) return false;
  const textGuard = loopBody.getStatements().find((statement) =>
    Node.isIfStatement(statement) && astIdentifierName(statement.getExpression()) === "text");
  const textBody = Node.isIfStatement(textGuard) ? textGuard.getThenStatement() : undefined;
  if (!Node.isBlock(textBody)) return false;
  const actual = textBody.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "actual")?.getInitializer();
  const matched = textBody.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "matched")?.getInitializer();
  if (!Node.isAwaitExpression(actual) || !Node.isConditionalExpression(matched)
    || astExpressionPath(matched.getCondition()) !== "text.exact") return false;
  const nodeTextCall = actual.getExpression();
  const exact = matched.getWhenTrue();
  const contains = matched.getWhenFalse();
  if (!Node.isCallExpression(nodeTextCall) || astExpressionPath(nodeTextCall.getExpression()) !== "nodeText"
    || astIdentifierName(nodeTextCall.getArguments()[2]) !== "nodeId"
    || !Node.isBinaryExpression(exact) || exact.getOperatorToken().getKind() !== SyntaxKind.EqualsEqualsEqualsToken
    || !zeroArgumentMethodCall(exact.getLeft(), "actual", "trim")
    || !zeroArgumentMethodCall(exact.getRight(), "text.value", "trim")
    || !Node.isCallExpression(contains) || astExpressionPath(contains.getExpression()) !== "actual.includes"
    || astExpressionPath(contains.getArguments()[0]!) !== "text.value") return false;
  const mismatch = textBody.getStatements().find((statement) => Node.isIfStatement(statement)
    && statement.getExpression().getText() === "!matched");
  const rejection = loopBody.getStatements().find((statement) => Node.isIfStatement(statement)
    && statement.getExpression().getText() === "reasons.length > 0");
  const rejectionBody = Node.isIfStatement(rejection) ? rejection.getThenStatement() : undefined;
  return Node.isIfStatement(mismatch)
    && mismatch.getThenStatement().getText() === 'reasons.push("TEXT_MISMATCH");'
    && Node.isBlock(rejectionBody)
    && rejectionBody.getStatements().some((statement) => Node.isContinueStatement(statement));
};

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
const staticReceipt = (lawId: string, check: string, passed = true) => [{
  check, implementationDigest: sha(Buffer.from(check)), lawId,
  nativeObservation: `typechecker:${sha(Buffer.from(`typechecker:${check}`))}`, passed,
}];
const externalFixtureRef = (kind: "exam" | "dynamic", selector: string): string =>
  `${kind}:${encodeURIComponent(fixtureEvidencePath)}#${encodeURIComponent(selector)}@${fixtureEvidenceDigest}`;
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

test("Exam and Dynamic evidence both require native current-run receipt locators", () => {
  const law = fixtureLaw();
  const missingExamLocator = resultFor(law);
  missingExamLocator.assertions.find((assertion) => assertion.evidenceMode.startsWith("exam."))!.refs = ["exam:fixture#script%3Dfixture"];
  assert.throws(
    () => buildQualityReport({ level: "READY", gitCommit: "a".repeat(40), laws: [law], results: [missingExamLocator] }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
  );
  assert.equal(validEvidenceRef("exam:package.json#script%3Dfixture"), false);
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
const examRef = (selector: string): string => `exam:${encodeURIComponent(fixtureEvidencePath)}#${encodeURIComponent(selector)}@${fixtureEvidenceDigest}`;
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
    observed_value: "native-fixture",
  };
  const observations = {
    browser: { browserVersion: "Chromium 1", endpoint: "https://example.test/", pageTitle: "Fixture",
      facts: { authority_present: true, extension_worker_count: 1 }, sessionFacts: { exactTarget: true } },
    service: { cleanupVerified: true, components: ["fixture"], endpoint: "http://127.0.0.1:4173",
      facts: {
        cleanup_verified: true,
        workbench_stopped: true,
        gate_a_through_e_completed: true,
        gate_a_n1_baseline_completed: true,
        gate_a_n1_regression_invalid_count: 0,
        gate_a_n1_new_claim_before_admission_count: 0,
        gate_a_n1_physical_submit_over_one_count: 0,
        gate_b_n2_canary_completed: true,
        gate_b_n2_post_submit_40s_page_command_count: 0,
        gate_b_n2_cross_job_close_impact_count: 0,
        exact_candidate_binding_valid: true,
      },
      processId: 4173, serviceName: "fixture", sourceFingerprint: "sha256:fixture", status: "healthy" },
    database: { databaseEngine: "sqlite", databasePath: "/tmp/fixture.sqlite",
      facts: { frozen_identity_invalid_count: 0, unscheduled_outbox_count: 0 },
      identitySet: ["job-1"], recordCounts: { tasks: 1 } },
    storage: { confirmedCount: 1, mutationCount: 1, storageEngine: "sqlite-wal",
      facts: { proof_job_pending_outbox_count: 0 }, storagePath: "/tmp/fixture.sqlite", unresolvedCount: 0 },
    provider: { catalogHash: "sha256:fixture", pluginIds: ["fixture-plugin"],
      facts: {
        ended_attempt_replay_count: 0,
        physical_submit_count: 1,
        provider_count: 1,
        provider_warning_count: 0,
        gate_a_n1_provider_warning_count: 0,
        gate_a_n1_warning_coverage_complete: true,
        gate_b_n2_provider_warning_count: 0,
        gate_b_n2_warning_coverage_complete: true,
        provider_warning_coverage_complete: true,
      },
      providerName: "ChatGPT", terminalReceiptCount: 39 },
    authorization: { authorityState: "present", fenceHashes: ["sha256:fixture"],
      facts: { unbound_lease_fence_job_count: 0 },
      grantCount: 1, principalIds: ["fixture-plugin"] },
    recovery: { finalState: "completed", observedStates: ["failed", "completed"],
      facts: {
        runtime_log_forbidden_task_state_field_count: 0,
      }, recoveryJobId: "job-1", unresolvedCount: 0 },
  } as const;
  const routes = {
    browser: { lawId: "LAW-LOCAL-BROWSER-SESSION-001-V4", clauses: ["forbidden:6"] },
    service: { lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V66", clauses: ["summary"] },
    database: { lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V66", clauses: ["forbidden:0", "forbidden:2"] },
    storage: { lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V66", clauses: ["forbidden:2"] },
    provider: { lawId: "LAW-GPT-001-V58", clauses: ["forbidden:0", "forbidden:3", "forbidden:7"] },
    authorization: { lawId: "LAW-AGENT-PRODUCTION-RUNTIME-002-V9", clauses: ["forbidden:1", "forbidden:2"] },
    recovery: { lawId: "LAW-RUNTIME-LOG-SPINE-001-V7", clauses: ["summary"] },
  } as const;
  for (const [kind, observation] of Object.entries(observations)) {
    const evidenceMode = `dynamic.${kind}`;
    const route = routes[kind as keyof typeof routes];
    const producerScript = kind === "browser" ? "acceptance:local-browser:real-proof"
      : kind === "provider" ? "acceptance:gpt:real-proof"
        : kind === "recovery" ? "acceptance:runtime-log-spine:real-proof"
          : "acceptance:agent-production-runtime:real-proof";
    const payload = { ...base, ...route, evidenceMode, observation_kind: kind, observation,
      producer_script: producerScript };
    const binding = { ...route, evidenceMode, observedValue: base.observed_value,
      proofRunId: base.proof_run_id, candidate: base.candidate, producerScript };
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
    const mismatchedClauses = route.clauses[0] === "forbidden:1" ? ["forbidden:2"] : ["forbidden:1"];
    assert.equal(validateDynamicReceiptPayload({ ...payload, clauses: mismatchedClauses }, binding), false,
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

test("Exam receipts bind executed semantic assertion callsites and reject fixed or drifted traces", () => {
  const sourcePath = resolve("scripts/acceptance/system-security.acceptance.ts");
  const source = readFileSync(sourcePath, "utf8");
  const sourceLines = source.split("\n");
  const sourceLineIndex = sourceLines.findIndex((line) => /\bassert(?:\.[A-Za-z]+)?\s*\(/u.test(line));
  assert.notEqual(sourceLineIndex, -1);
  const binding = {
    lawId: "LAW-SYSTEM-SECURITY-001-V6", evidenceMode: "exam.golden",
    clauses: ["forbidden:0", "summary"], observedValue: "semantic-mutants-rejected",
    caseLocator: "acceptance:system-security:attack-mutants", proofRunId: "a".repeat(64),
    candidate: "b".repeat(40), producerScript: "acceptance:system-security",
  };
  const trace = {
    schema_version: "governance-exam-assertion.v1", proof_run_id: binding.proofRunId,
    candidate: binding.candidate, producer_script: binding.producerScript, process_id: 4173, sequence: 1,
    method: "equal", source_path: sourcePath, source_line: sourceLineIndex + 1, source_column: 1,
    source_digest: sha(source), source_line_digest: sha(sourceLines[sourceLineIndex]!), argument_digest: "c".repeat(64),
  };
  const payload = {
    schema_version: "governance-exam-observation.v1", proof_run_id: binding.proofRunId,
    candidate: binding.candidate, lawId: binding.lawId, evidenceMode: binding.evidenceMode,
    clauses: binding.clauses, case_locator: binding.caseLocator, observed_value: binding.observedValue,
    producer_script: binding.producerScript, captured_at: "2026-09-02T00:00:00.000Z", assertion_traces: [trace],
  };
  assert.equal(validateExamReceiptPayload(payload, binding), true);
  assert.equal(validateExamReceiptPayload({ ...payload, assertion_traces: [] }, binding), false);
  assert.equal(validateExamReceiptPayload({ ...payload,
    assertion_traces: [{ ...trace, source_line_digest: "d".repeat(64) }] }, binding), false);
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
  assert.throws(
    () => bindNativeProofObservations(oneNativeObservation, routes, requests, script, "exam"),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
    "an Exam stdout claim without an executed assertion receipt must fail closed",
  );
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

test("Exam observations reject duplicate self-attested stdout before route binding", () => {
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
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_EVIDENCE_MISSING",
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

test("Dynamic routes cannot substitute one mode-bound receipt locator", () => {
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
        evidenceMode: "static.ast", passed: true, refs: staticEvidenceRefs(context, "LAW-FIXTURE-001-V1", "static.ast", staticClauses(0), staticReceipt("LAW-FIXTURE-001-V1", "requirementFor"), ["requirementFor"]) }], findings: [] }],
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
        evidenceMode: "static.ast", passed: true, refs: staticEvidenceRefs(context, "LAW-FIXTURE-001-V1", "static.ast", staticClauses(1), staticReceipt("LAW-FIXTURE-001-V1", "requirementFor"), ["requirementFor"]) }], findings: [] }],
      inspectedFiles: ["package.json"],
    }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE",
  );
  assert.doesNotThrow(
    () => validateStaticInspection(context, {
      capabilityDomain: "fixture", reportedLawIds: ["LAW-FIXTURE-001-V1"],
      lawResults: [{ lawId: "LAW-FIXTURE-001-V1", assertions: [{ clauses: staticClauses(),
        evidenceMode: "static.ast", passed: true,
        refs: staticEvidenceRefs(context, "LAW-FIXTURE-001-V1", "static.ast", staticClauses(), staticReceipt("LAW-FIXTURE-001-V1", "requirementFor"), ["requirementFor"]) }], findings: [] }],
      inspectedFiles: ["package.json"],
    }),
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
  const refs = staticEvidenceRefs(context, "LAW-FIXTURE-001-V1", "static.ast", staticClauses(0), staticReceipt("LAW-FIXTURE-001-V1", "requirementFor"), ["requirementFor"]);
  const output = validateStaticInspection(context, { capabilityDomain: "fixture", reportedLawIds: ["LAW-FIXTURE-001-V1"],
    lawResults: [{ lawId: "LAW-FIXTURE-001-V1", assertions: [{ clauses: staticClauses(0), evidenceMode: "static.ast",
      passed: true, refs }], findings: [] }], inspectedFiles: [targetPath] });
  const validatedRefs = output.lawResults[0]!.assertions[0]!.refs;
  assert.equal(validatedRefs.some((ref) => ref.startsWith(`ast:${targetPath}#`)), true);
  assert.equal(validatedRefs.some((ref) => ref.includes("semanticChecks%3DrequirementFor")), true);
  assert.equal(validatedRefs.some((ref) => ref.includes("executionResult%3Dpassed")), true);
  assert.equal(validatedRefs.some((ref) => ref.includes("clauses%3Dforbidden%3A0%2Csummary")), true);
});

test("static evidence binds every object in the exact governed scope", () => {
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
  const refs = staticEvidenceRefs(context, "LAW-FIXTURE-001-V1", "static.ast", staticClauses(0), staticReceipt("LAW-FIXTURE-001-V1", "requirementFor"), ["requirementFor"]);
  const output = validateStaticInspection(context, { capabilityDomain: "fixture", reportedLawIds: ["LAW-FIXTURE-001-V1"],
    lawResults: [{ lawId: "LAW-FIXTURE-001-V1", assertions: [{ clauses: staticClauses(0), evidenceMode: "static.ast",
      passed: true, refs }], findings: [] }], inspectedFiles: [pathWithReservedCharacter, targetPath] });
  const validatedRefs = output.lawResults[0]!.assertions[0]!.refs;
  assert.equal(validatedRefs.includes("scope:LAW-FIXTURE-001-V1#appliesTo-minus-excludes"), true);
  assert.equal(validatedRefs.some((ref) => ref.includes(pathWithReservedCharacter)), false);
  assert.equal(validatedRefs.filter((ref) => !ref.startsWith("scope:")).length, 1);
  assert.equal(validatedRefs.some((ref) => ref.includes("targetSetDigest%3D")), true);
});

test("static evidence rejects a governed wrong-object substitution", () => {
  const lawId = "LAW-FIXTURE-001-V1";
  const targetPaths = ["package.json", "pnpm-workspace.yaml"];
  const context = {
    sealedRoot: process.cwd(), project: new Project({ tsConfigFilePath: "tsconfig.json" }),
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: "scripts/audit/shared/static-inspection-contract.ts" },
    lawRequirements: [{ lawId, forbiddenCount: 1, requiredStaticModes: ["static.ast"], targetPaths,
      targetSet: { queryRef: `scope:${lawId}#appliesTo-minus-excludes`, count: targetPaths.length } }],
  } as unknown as InspectorContext;
  const refs = staticEvidenceRefs(context, lawId, "static.ast", staticClauses(0),
    staticReceipt(lawId, "inspectSemanticContract"), ["inspectSemanticContract"]);
  const wrongObjectRefs = refs.filter((reference) => !reference.startsWith("ast:package.json#"));
  assert.throws(() => validateStaticInspection(context, {
    capabilityDomain: "fixture", reportedLawIds: [lawId], inspectedFiles: targetPaths,
    lawResults: [{ lawId, assertions: [{ clauses: staticClauses(0), evidenceMode: "static.ast",
      passed: true, refs: wrongObjectRefs }], findings: [] }],
  }), (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE");
});

test("retired APP authority Exam rejects semantic wrong-object substitutions", () => {
  const path = "scripts/acceptance/app-shell-retired-authority-absence.acceptance.ts";
  const source = readFileSync(path, "utf8");
  assert.deepEqual(retiredAuthorityExamContractViolations(source), []);
  for (const [label, before, after] of [
    ["path", "docs/法案辅助文件/GrassEye APP 用户需求启动施工图.md", "docs/unrelated.md"],
    ["title", "GrassEye APP 用户需求启动施工图", "Unrelated title"],
    ["repository denominator", '"git", ["ls-files", "--cached", "--others", "--exclude-standard"]', '"git", ["status"]'],
    ["physical absence", "assert.equal(existsSync(legacyDocPath), false", "assert.equal(true, true"],
    ["copy absence", "assert.equal(copiedVariant, false", "assert.equal(true, false"],
    ["reference absence", "assert.equal(referencesRetiredAuthority, false", "assert.equal(true, false"],
    ["locator", "acceptance:app-shell-ui:retired-startup-blueprint-physical-absence", "acceptance:app-shell-ui:active-skill-registry"],
  ] as const) {
    const mutant = source.replace(before, after);
    assert.notEqual(mutant, source, label);
    assert.notDeepEqual(retiredAuthorityExamContractViolations(mutant), [], label);
  }
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
    ["inspectRetiredSurfaceAbsence"]);
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
  const modeSelector = (mode: string): string[] => staticEvidenceRefs(context, lawId, mode, staticClauses(0), staticReceipt(lawId, "requirementFor"), ["requirementFor"])
    .filter((ref) => !ref.startsWith("scope:"));
  assert.equal(modeSelector("static.ast").some((ref) => ref.includes("semanticChecks%3DrequirementFor")), true);
  for (const mode of context.lawRequirements[0]!.requiredStaticModes) {
    assert.equal(modeSelector(mode).some((ref) =>
      ref.includes(encodeURIComponent(`lawId=${lawId};mode=${mode};`))), true);
  }
  assert.equal(modeSelector("static.types").every((ref) => ref.startsWith("test:")), true);
  assert.equal(modeSelector("static.types").every((ref) => ref.includes("modeNativeObservation%3Dtypechecker%3A")), true);
  assert.equal(modeSelector("static.contract").every((ref) => ref.startsWith("config:")), true);
  assert.equal(modeSelector("static.dependency").every((ref) => ref.startsWith("dependency:")), true);
  assert.equal(modeSelector("static.config").every((ref) => ref.startsWith("config:")), true);
  assert.equal(modeSelector("static.json").every((ref) => ref.startsWith("json:")), true);
  assert.equal(modeSelector("static.yaml").every((ref) => ref.startsWith("yaml:")), true);
});

test("static evidence rejects a substituted mode-native observation", () => {
  const lawId = "LAW-FIXTURE-001-V1";
  const targetPath = "scripts/audit/shared/static-inspection-contract.ts";
  const context = {
    sealedRoot: process.cwd(), project: new Project({ tsConfigFilePath: "tsconfig.json" }),
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: targetPath },
    lawRequirements: [{ lawId, forbiddenCount: 1, requiredStaticModes: ["static.types"],
      targetPaths: [targetPath], targetSet: { queryRef: `scope:${lawId}#appliesTo-minus-excludes`, count: 1 } }],
  } as unknown as InspectorContext;
  const refs = staticEvidenceRefs(context, lawId, "static.types", staticClauses(0),
    staticReceipt(lawId, "inspectTypes"), ["inspectTypes"]);
  const mutant = refs.map((ref) => ref.replace(
    /modeNativeObservation%3Dtypechecker%3A[a-f0-9]{64}/u,
    `modeNativeObservation%3Dstatic.ast%3A${"a".repeat(64)}`,
  ));
  assert.throws(() => validateStaticInspection(context, {
    capabilityDomain: "fixture", reportedLawIds: [lawId], inspectedFiles: [targetPath],
    lawResults: [{ lawId, assertions: [{ clauses: staticClauses(0), evidenceMode: "static.types",
      passed: true, refs: mutant }], findings: [] }],
  }), (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE");
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
      [check]) });
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

test("a no-op or unexecuted producer semantic check cannot mint static evidence", () => {
  const sealedRoot = mkdtempSync(resolve(tmpdir(), "static-semantic-check-"));
  const ownerPath = "scripts/audit/domains/fixture/inspector.ts";
  const targetPath = "src/fixture.ts";
  mkdirSync(resolve(sealedRoot, "scripts/audit/domains/fixture"), { recursive: true });
  mkdirSync(resolve(sealedRoot, "src"), { recursive: true });
  writeFileSync(resolve(sealedRoot, ownerPath), "inspectSemanticContract();\n");
  writeFileSync(resolve(sealedRoot, targetPath), "export const fixture = true;\n");
  const project = new Project();
  const owner = project.addSourceFileAtPath(resolve(sealedRoot, ownerPath));
  project.addSourceFileAtPath(resolve(sealedRoot, targetPath));
  const lawId = "LAW-FIXTURE-001-V1";
  const context = {
    sealedRoot, project,
    planEntry: { capabilityDomain: "fixture", ownerInspectorPath: ownerPath },
    lawRequirements: [{ lawId, forbiddenCount: 1, requiredStaticModes: ["static.ast"], targetPaths: [targetPath],
      targetSet: { queryRef: `scope:${lawId}#appliesTo-minus-excludes`, count: 1 } }],
  } as unknown as InspectorContext;
  const findings: import("../../scripts/audit/shared/inspector-contracts.js").InspectorFinding[] = [];
  const receipts: import("../../scripts/audit/shared/inspector-contracts.js").StaticCheckReceipt[] = [];
  let executionCount = 0;
  const inspectNoop = (): void => { executionCount += 1; };
  assert.throws(() => recordStaticCheck({ check: "inspectNoop", findings, implementation: inspectNoop,
    lawIds: [lawId], receipts, run: () => inspectNoop() }),
  (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE");
  assert.equal(executionCount, 0);
  const inspectFixedPass = (source: string): boolean => source.length >= 0;
  assert.throws(() => recordStaticCheck({ check: "inspectFixedPass", findings,
    implementation: inspectFixedPass, lawIds: [lawId], receipts,
    run: () => inspectFixedPass(readFileSync(resolve(sealedRoot, targetPath), "utf8")) }),
  (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE");
  const inspectSemanticContract = (source: string, targetFindings: typeof findings): void => {
    if (!source.includes("fixture = true")) targetFindings.push({
      checkId: "fixture/semantic-contract", clauseId: "forbidden:0", evidenceMode: "static.ast",
      lawId, message: "fixture semantic contract is absent", severity: "fatal",
    });
  };
  recordStaticCheck({ check: "inspectSemanticContract", findings, implementation: inspectSemanticContract,
    lawIds: [lawId], receipts,
    run: () => inspectSemanticContract(readFileSync(resolve(sealedRoot, targetPath), "utf8"), findings) });
  assert.equal(receipts[0]!.implementationDigest, staticImplementationDigest(inspectSemanticContract));
  assert.equal(staticEvidenceRefs(context, lawId, "static.ast", staticClauses(0), receipts, ["inspectSemanticContract"]).length, 2);
  assert.throws(() => recordStaticCheck({ check: "inspectSemanticContract", findings,
    implementation: inspectSemanticContract, lawIds: [lawId], receipts: [], run: () => undefined }),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE");
  owner.replaceWithText("if (false) { inspectSemanticContract(); }\n");
  assert.throws(
    () => staticEvidenceRefs(context, lawId, "static.ast", staticClauses(0), [], ["inspectSemanticContract"]),
    (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE",
  );
  receipts[0]!.implementationDigest = "invalid";
  assert.throws(() => staticEvidenceRefs(context, lawId, "static.ast", staticClauses(0), receipts,
    ["inspectSemanticContract"]),
  (error: unknown) => error instanceof GovernanceError && error.code === "LAW_CHECK_EXECUTION_INCOMPLETE");
  writeFileSync(resolve(sealedRoot, targetPath), "export const fixture = false;\n");
  const mutantFindings: typeof findings = [];
  const mutantReceipts: typeof receipts = [];
  recordStaticCheck({ check: "inspectSemanticContract", findings: mutantFindings,
    implementation: inspectSemanticContract, lawIds: [lawId], receipts: mutantReceipts,
    run: () => inspectSemanticContract(readFileSync(resolve(sealedRoot, targetPath), "utf8"), mutantFindings) });
  assert.equal(producerModePassed(mutantReceipts, lawId, ["inspectSemanticContract"]), false);
  assert.equal(mutantFindings[0]!.checkId, "fixture/semantic-contract");
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
  assert.equal(staticContract.includes("objectDigest="), true);
  assert.equal(staticContract.includes("targetSetDigest="), true);
  assert.equal(staticContract.includes("checkImplementations="), true);
  assert.equal(staticContract.includes("modeNativeObservation="), true);
  const retiredObservers = readFileSync("scripts/audit/shared/static-target-object-inspector.ts", "utf8");
  assert.equal(retiredObservers.includes("observeStaticMode"), true);
  assert.equal(qualityContract.includes('"static.types": "test"'), true);
  assert.equal(qualityContract.includes('"static.types": "ast"'), false);
  const agent = readFileSync("scripts/audit/domains/agent-production-runtime/session-output.ts", "utf8");
  const gpt = readFileSync("scripts/audit/domains/gpt/inspector.ts", "utf8");
  const capability = readFileSync("scripts/audit/domains/capability-governance/inspector.ts", "utf8");
  const directProofs = [
    "scripts/acceptance/agent-production-runtime.real-proof.ts",
    "scripts/acceptance/gpt.real-proof.ts",
    "scripts/acceptance/local-browser.real-proof.ts",
    "scripts/acceptance/runtime-log-spine.real-proof.ts",
  ].map((path) => readFileSync(path, "utf8"));
  const uniqueModeChecks = (source: string, expectedCount: number): boolean => {
    const body = /const MODE_CHECKS = \{([\s\S]*?)\} as const;/u.exec(source)?.[1] ?? "";
    const checks = [...body.matchAll(/"static\.[a-z]+": \["([A-Za-z]+)"\]/gu)].map((match) => match[1]!);
    return checks.length === expectedCount && new Set(checks).size === expectedCount;
  };
  assert.equal(uniqueModeChecks(agent, 6), true);
  assert.equal(uniqueModeChecks(gpt, 5), true);
  assert.equal(uniqueModeChecks(agent.replace('"static.types": ["inspectAgentTypes"]',
    '"static.types": ["inspectAgentProductionRuntime"]'), 6), false);
  assert.equal(capability.includes('mode === "static.types" ? ["inspectCapabilityFacadeTypes"]'), true);
  assert.equal(capability.replace('mode === "static.types" ? ["inspectCapabilityFacadeTypes"]',
    'mode === "static.types" ? ["pushMissingFacadeExportConsumers"]')
    .includes('mode === "static.types" ? ["inspectCapabilityFacadeTypes"]'), false);
  for (const directProof of directProofs) {
    assert.equal(directProof.includes("GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_BEGIN"), true);
    assert.equal(directProof.includes("OWNER_ISOLATED_RELEASE_PROOF_NOT_ADMITTED"), true);
    assert.equal(directProof.includes("writeFileSync"), false);
  }
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

test("bounded quality execution preserves order, reaches its cap, and fails closed after all work", async () => {
  let active = 0;
  let peak = 0;
  const ordered = await mapWithConcurrency([3, 1, 2, 0], 2, async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise<void>((resolveTurn) => setImmediate(resolveTurn));
    active -= 1;
    return value * 2;
  });
  assert.deepEqual(ordered, [6, 2, 4, 0]);
  assert.equal(peak, 2);

  let completed = 0;
  let rejected = false;
  try {
    await mapWithConcurrency([0, 1, 2], 2, async (value) => {
      await new Promise<void>((resolveTurn) => setImmediate(resolveTurn));
      completed += 1;
      if (value === 1) throw undefined;
      return value;
    });
  } catch (error) {
    rejected = true;
    assert.equal(error, undefined);
  }
  assert.equal(rejected, true);
  assert.equal(completed, 3);
});

test("sealed target digests detect mutation and inspector workers load only the selected domain", () => {
  const root = mkdtempSync(resolve(tmpdir(), "quality-sealed-digest-"));
  const target = resolve(root, "target.ts");
  writeFileSync(target, "before");
  const before = sealedSnapshotDigest(root, ["target.ts"]);
  writeFileSync(target, "after");
  assert.notEqual(sealedSnapshotDigest(root, ["target.ts"]), before);

  const worker = readFileSync("scripts/audit/shared/quality-inspector-worker.ts", "utf8");
  assert.equal(worker.includes("import { inspectDomain as"), false);
  assert.equal([...worker.matchAll(/: \(\) => import\(/gu)].length, buildRegistry().domains.length);
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
    "docs/specs/agent-production-runtime/agent-route-capability-manifest.provider.spec.json", "utf8",
  )) as unknown;
  assert.doesNotThrow(() => validateProviderContractSpec(current, "ADVISION-X/AGENT",
    new Map([
      ["LAW-AGENT-PRODUCTION-RUNTIME-001-V66", "agent-production-runtime"],
      ["LAW-AGENT-PRODUCTION-RUNTIME-003-V38", "agent-production-runtime"],
    ]),
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
  const lawDomains = new Map([[law.lawId, law.capabilityDomain], ["LAW-BLUEPRINT-DEPENDENCY-001-V1", secondDomain]]);
  const contexts = [new Set([law.lawId]), domains, new Set<string>(), new Map<string, string>(), lawDomains,
    new Map<string, readonly string[]>()] as const;
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
    new Map([[remoteRef, "ADVISION-X/provider"]]), lawDomains, new Map()), true);
  assert.equal(blueprintValid(remoteBase, new Set([law.lawId]), domains, new Set([remoteRef]),
    new Map([[remoteRef, "ADVISION-X/other"]]), lawDomains, new Map()), false);
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
    new Map(),
  ), false);
  const dependencyLawId = "LAW-BLUEPRINT-DEPENDENCY-001-V1";
  const dependencyContext = [new Set([law.lawId, dependencyLawId]), domains, new Set<string>(),
    new Map<string, string>(), lawDomains, new Map([[law.lawId, [dependencyLawId]]])] as const;
  assert.equal(blueprintValid(base, ...dependencyContext), false);
  assert.equal(blueprintValid({ ...base, dependencyEdges: [{ contractRef: null,
    from: { domain: law.capabilityDomain, repo: "local" }, to: { domain: secondDomain, repo: "local" } }] },
  ...dependencyContext), true);
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

test("blueprint prose cannot shadow machine contract identity", () => {
  const source = "```blueprint-record\n{}\n```\n\n`provider.runtime-events@2` is active.\n";
  const authority = [{ contractId: "provider.runtime-events", version: 2 }];
  assert.doesNotThrow(() => assertBlueprintMarkdownContractAuthority(source, authority));
  assert.throws(
    () => assertBlueprintMarkdownContractAuthority(source.replace("@2", "@1"), authority),
    (error: unknown) => error instanceof GovernanceError && error.code === "BLUEPRINT_CONTRACT_IDENTITY_CONFLICT",
  );
  assert.throws(
    () => assertBlueprintMarkdownContractAuthority(`${source}consumer must bind exact spec SHA-256.\n`, authority),
    (error: unknown) => error instanceof GovernanceError && error.code === "BLUEPRINT_PROVIDER_IDENTITY_BINDING_FORBIDDEN",
  );
  assert.throws(
    () => assertBlueprintMarkdownContractAuthority(`${source}provider commit and digest 对账 are mandatory.\n`, authority),
    (error: unknown) => error instanceof GovernanceError && error.code === "BLUEPRINT_PROVIDER_IDENTITY_BINDING_FORBIDDEN",
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
  const agentLaw = registry.laws.find((law) => law.lawId === "LAW-AGENT-PRODUCTION-RUNTIME-001-V66");
  assert.ok(agentLaw);
  const agentTargets = computeTargetPaths(agentLaw, registry);
  const crossOwnerPaths = [
    "src/lib/browser/exact-target/browser-command-actor.ts",
    "src/lib/browser/exact-target/browser-mutation-store.ts",
  ];
  for (const path of crossOwnerPaths) assert.equal(agentTargets.includes(path), false, path);

  const agentInspector = readFileSync(
    "scripts/audit/domains/agent-production-runtime/inspector.ts", "utf8",
  );
  for (const path of crossOwnerPaths) assert.equal(agentInspector.includes(path), false, path);
  for (const token of [
    "ProductionGptChildTools", "gpt.execute(intent", "runAtomicStep(",
    'mutationMode: "readback"', "childCapabilityId", "inputHash",
  ]) assert.equal(agentInspector.includes(token), false, token);

  const browserInspector = [
    "scripts/audit/domains/local-browser-session/mutation-atomicity-inspection.ts",
    "scripts/audit/domains/local-browser-session/mutation-registry-inspection.ts",
  ].map((path) => readFileSync(path, "utf8")).join("\n");
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
    "markDispatched", "markReceiptMissing", "dispatchedForBinding", "readAtomicStepOutcome",
    "logicalMutationId", "positivePostconditionHash", "attempt_id=?", '"DISPATCHED"',
  ]) assert.equal(activeInspectors.includes(current), true, current);
  const browserLane = [
    "src/lib/browser/infrastructure/browser-lane-coordinator.ts",
    "src/lib/browser/infrastructure/browser-target-acquirer.ts",
  ].map((path) => readFileSync(path, "utf8")).join("\n");
  for (const retired of [
    "private unsettled", "acquireReconciliation", "reconciliationAllowed",
    "callRecoveryScope", "atomicStepRecovery", "reconciliationScope",
  ]) {
    assert.equal(browserLane.includes(retired), false, retired);
  }
  for (const current of [
    "targetMode", "ensureAvailableTarget(waiter, parentConversationUrl)",
    'const park: BrowserTargetLease["park"]',
  ]) {
    assert.equal(browserLane.includes(current), true, current);
  }
  const browserStaticInspectors = [
    "browser-mutation-settlement-inspection.ts", "dom-mechanical-facts-inspection.ts",
    "mutation-atomicity-inspection.ts", "mutation-registry-inspection.ts",
    "opaque-proof-inspection.ts", "target-claim-inspection.ts",
  ].map((name) => readFileSync(`scripts/audit/domains/local-browser-session/${name}`, "utf8"));
  for (const source of browserStaticInspectors) {
    assert.equal(source.includes("scripts/acceptance"), false);
    assert.equal(source.includes("real-proof"), false);
    assert.equal(source.includes("src/lib/local-runtime"), false);
  }
  const browserStaticSource = browserStaticInspectors.join("\n");
  for (const currentOwner of [
    "src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts",
    "src/lib/browser/infrastructure/browser-target-acquirer.ts",
  ]) assert.equal(browserStaticSource.includes(currentOwner), true, currentOwner);
});

test("local Browser static source lookup fails closed outside the law target set", () => {
  const lawId = "LAW-LOCAL-BROWSER-SESSION-004-V19";
  const findings: import("../../scripts/audit/shared/inspector-contracts.js").InspectorFinding[] = [];
  const context = {
    project: new Project({ useInMemoryFileSystem: true }),
    targetPaths: ["src/lib/browser/inside.ts"],
    lawRequirements: [{ lawId, targetPaths: ["src/lib/browser/inside.ts"] }],
  } as unknown as InspectorContext;
  assert.equal(requireSource(context, findings, lawId, "scripts/acceptance/outside.ts"), null);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.checkId, "browser-authority/static-source-scope");
});

test("active Browser and Runtime Log inspectors reject semantic decoys", () => {
  const inspectSource = (path: string, source: string) => {
    const project = new Project({ useInMemoryFileSystem: true });
    return project.createSourceFile(path, source);
  };
  const domPath = "src/lib/browser/chrome-extension/dom-query-runtime.ts";
  const dom = readFileSync(domPath, "utf8");
  assert.equal(exactTextMatcherIsStrict(inspectSource(domPath, dom)), true);
  for (const mutant of [
    dom.replace("actual.trim() === text.value.trim()", "actual === text.value"),
    dom.replace("actual.trim() === text.value.trim()", "actual.includes(text.value)"),
    dom.replace("actual.trim() === text.value.trim()", "actual.trim() != text.value.trim()"),
    dom.replace('reasons.push("TEXT_MISMATCH")', 'reasons.push("NOT_TEXT_MISMATCH")'),
    dom.replace("reasons.length > 0", "reasons.length < 0"),
  ]) assert.equal(exactTextMatcherIsStrict(inspectSource(domPath, mutant)), false);

  const loggerPath = "src/lib/runtime-logs/logger.ts";
  const logger = readFileSync(loggerPath, "utf8");
  assert.equal(redactHashWriteOrderIsExact(inspectSource(loggerPath, logger)), true);
  const redactionDecoy = logger.replace(
    "const unsigned = redactedUnsigned(unsignedInput);", "const unsigned = unsignedInput;",
  );
  assert.equal(redactHashWriteOrderIsExact(inspectSource(loggerPath, redactionDecoy)), false);
});

test("Browser inspectors admit only the exact row-preserving WAL constraint migration and atomic assistant reads", () => {
  const inspectSource = (path: string, source: string) => {
    const project = new Project({ useInMemoryFileSystem: true });
    return project.createSourceFile(path, source);
  };
  const schemaPath = "src/lib/browser/exact-target/browser-mutation-schema.ts";
  const schema = readFileSync(schemaPath, "utf8");
  assert.equal(browserMutationSchemaMigrationIsCurrent(inspectSource(schemaPath, schema)), true);
  for (const mutant of [
    schema.replace("mutation_outcome text check(mutation_outcome in ('no','dispatched','confirmed'))", "mutation_outcome text"),
    schema.replace("native_cause_code text", "native_failure_text text"),
    schema.replace('"provider_recovery_payload",', '"provider_recovery_alias",'),
    schema.replace("columns.length !== requiredColumns.length", "columns.length === requiredColumns.length"),
    schema.replace("check(physical_input_count between 0 and 4)", "check(physical_input_count between 0 and 9)"),
    schema.replace("database.transaction(() =>", "(() =>"),
    schema.replace("before.count !== after.count", "before.count === after.count"),
    schema.replace("drop table ${migrationTable}", "drop table browser_mutations"),
  ]) assert.equal(browserMutationSchemaMigrationIsCurrent(inspectSource(schemaPath, mutant)), false);

  const exactPath = "src/lib/browser/chrome-extension/dom-exact-assistant-turn.ts";
  const exact = readFileSync(exactPath, "utf8");
  assert.equal(exactAssistantTurnReadIsAtomic(inspectSource(exactPath, exact)), true);
  for (const mutant of [
    exact.replace("${BROWSER_CANONICAL_SEMANTIC_TEXT_READER_SOURCE}", ""),
    exact.replace("document.querySelectorAll(\"[data-testid^='conversation-turn-']\")",
      "document.querySelector(\"[data-testid^='conversation-turn-']\")"),
    exact.replace("browserCanonicalSemanticText(node)", 'node.textContent ?? ""'),
    exact.replace("if (currentUrl !== expectedUrl || rawCount !== 1)",
      "if (currentUrl !== expectedUrl || assistantIndex !== turns.length - 1 || rawCount !== 1)"),
    exact.replace("if (currentUrl !== expectedUrl || rawCount !== 1)",
      "if (currentUrl !== expectedUrl || composerRaw !== 1 || rawCount !== 1)"),
    exact.replace("if (currentUrl !== expectedUrl || rawCount !== 1)",
      "if (currentUrl !== expectedUrl || !node.getClientRects().length || rawCount !== 1)"),
    exact.replace("if (currentUrl !== expectedUrl || rawCount !== 1)",
      "if (currentUrl !== expectedUrl || !node.checkVisibility() || rawCount !== 1)"),
    exact.replace("if (currentUrl !== expectedUrl || rawCount !== 1)",
      "if (currentUrl !== expectedUrl || node.hidden || rawCount !== 1)"),
    exact.replace("if (currentUrl !== expectedUrl || rawCount !== 1)",
      "if (currentUrl !== expectedUrl || node.ariaHidden || rawCount !== 1)"),
    exact.replace("if (currentUrl !== expectedUrl || rawCount !== 1)",
      "if (currentUrl !== expectedUrl || node.inert || rawCount !== 1)"),
    exact.replace("if (currentUrl !== expectedUrl || rawCount !== 1)",
      "if (currentUrl !== expectedUrl || precedingPromptHash !== expectedPromptHash || rawCount !== 1)"),
    exact.replace("if (currentUrl !== expectedUrl || rawCount !== 1)",
      "if (currentUrl !== expectedUrl || thirdGate || rawCount !== 1)"),
    exact.replace("loaderAfter !== expectedMainFrameLoaderId", "loaderAfter === expectedMainFrameLoaderId"),
    exact.replaceAll("exact-user-turn-unavailable", "generic-candidate-missing"),
    exact.replaceAll("BROWSER_ADJACENT_ASSISTANT_TURN_MISSING", "BROWSER_DOM_CANDIDATE_MISSING"),
    `${exact}\nvoid queryCandidateSet;`,
  ]) assert.equal(exactAssistantTurnReadIsAtomic(inspectSource(exactPath, mutant)), false);
});

test("GPT text-response settlement keeps stop and text inside the frozen second gate", () => {
  const path = "src/capabilities/gpt/children/checkpoint_gpt_text_response/handler.ts";
  const source = readFileSync(path, "utf8");
  assert.equal(textResponseTwoGateSettlementIsFrozen(source), true);
  for (const mutant of [
    source.replace("while (Date.now() < deadline || exactResponseObserved)",
      "while (Date.now() < deadline)"),
    source.replace("Date.now() + GPT_STOPPED_EMPTY_CONFIRMATION_MS : deadline", "deadline"),
    source.replace("if (exactResponseObserved) continue", "if (exactResponseObserved) break"),
    source.replace("nextWaitReason = \"exact-user-turn-unavailable\"",
      "nextWaitReason = \"adjacent-assistant-missing\""),
    source.replace("observationDeadline, nextWaitReason", "observationDeadline, \"initial-observation\""),
    source.replace(
      "assistant && assistant.generatingRaw === 0 && assistant.semanticText.trim().length > 0",
      "assistant && assistant.hidden === false && assistant.generatingRaw === 0 && assistant.semanticText.trim().length > 0",
    ),
    source.replace(
      "observation.generatingRaw > 0 || observation.semanticText.trim().length > 0",
      "observation.generatingRaw > 0 || observation.composerRaw > 0 || observation.semanticText.trim().length > 0",
    ),
  ]) assert.equal(textResponseTwoGateSettlementIsFrozen(mutant), false);
});

test("GPT Provider wait reasons remain a closed diagnostic projection", () => {
  const contract = readFileSync("src/capabilities/gpt/contract.ts", "utf8");
  const lifecycle = readFileSync("src/capabilities/gpt/production-browser-lifecycle.ts", "utf8");
  const textHandler = readFileSync(
    "src/capabilities/gpt/children/checkpoint_gpt_text_response/handler.ts", "utf8",
  );
  const imageHandler = readFileSync(
    "src/capabilities/gpt/children/checkpoint_gpt_generated_image/handler.ts", "utf8",
  );
  const valid = (contractSource = contract, lifecycleSource = lifecycle,
    textSource = textHandler, imageSource = imageHandler) => providerWaitReasonProjectionIsFrozen(
    contractSource, lifecycleSource, textSource, imageSource,
  );
  assert.equal(valid(), true);
  assert.equal(valid(contract.replace("reason: GptProviderObservationWaitReason", "reason?: string")), false);
  assert.equal(valid(contract, lifecycle.replace(
    "GPT_PROVIDER_WAIT_EXACT_USER_TURN_UNAVAILABLE", "GPT_PROVIDER_WAIT_ACTIVE",
  )), false);
  assert.equal(valid(contract, lifecycle, textHandler.replace(
    "observationDeadline, nextWaitReason", 'observationDeadline, "initial-observation"',
  )), false);
  assert.equal(valid(contract, lifecycle, `${textHandler}\nif (nextWaitReason) throw new Error();`), false);
  assert.equal(valid(contract, lifecycle, textHandler, imageHandler.replace(
    'deadline, "generated-image-source-pending"', 'deadline, "initial-observation"',
  )), false);
});

test("GPT mutation inspection permits bounded reads but rejects looped or concurrent dispatch", () => {
  const source = (body: string) => {
    const project = new Project({ useInMemoryFileSystem: true });
    return project.createSourceFile("src/capabilities/gpt/mutant.ts", body);
  };
  assert.equal(containsPageMutation(source(`for (const candidate of candidates) {
    await browser.executeDomIntent({ kind: "find", selector: candidate.selector, maxMatches: 2 });
  }`)), false);
  assert.equal(containsPageMutation(source(`for (const candidate of candidates) {
    await browser.executeDomIntent({ kind: "click", selector: candidate.selector, expectedMatches: 1 });
  }`)), true);
  assert.equal(containsPageMutation(source("await Promise.all([readFile(first), readFile(second)]);")), false);
  assert.equal(containsPageMutation(source(`await Promise.all([
    browser.executeDomIntent({ kind: "click", selector: "button", expectedMatches: 1 }),
  ]);`)), true);
});

test("GPT inspection rejects private persistence and worker infrastructure while preserving Owner ports", () => {
  const source = (path: string, body: string) => {
    const project = new Project({ useInMemoryFileSystem: true });
    return project.createSourceFile(path, body);
  };
  assert.deepEqual(gptPrivateInfrastructureViolations(source(
    "src/capabilities/gpt/private-queue.ts", 'import Database from "better-sqlite3"; class GptEvidenceStore {}',
  )), ["declaration:GptEvidenceStore", "import:better-sqlite3", "path:private-queue.ts"]);
  assert.deepEqual(gptPrivateInfrastructureViolations(source(
    "src/capabilities/gpt/production-ports.ts",
    'import type { RuntimeLogger } from "../../lib/runtime-logs/index.js"; interface GptEvidenceStorePort {}',
  )), []);
});

test("every declared Dynamic mode has one exact producer claim route", () => {
  const registry = buildRegistry();
  const expectedByScript = new Map<string, string[]>();
  for (const law of registry.laws) for (const mode of law.evidenceModes.filter((item) => item.startsWith("dynamic."))) {
    const script = dynamicScriptFor(law.capabilityDomain, mode);
    expectedByScript.set(script, [...(expectedByScript.get(script) ?? []), `${law.lawId}:${mode}`]);
  }
  for (const [script, routes] of expectedByScript) {
    assert.deepEqual(producerClaimRoutesFor(script), routes.sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right))));
  }
});

test("a law-authorized summary-only Dynamic claim validates against its exact producer fact", () => {
  const binding = {
    lawId: "LAW-RUNTIME-LOG-SPINE-001-V7", evidenceMode: "dynamic.browser", clauses: ["summary"],
    observedValue: "native-runtime-log", proofRunId: "a".repeat(64), candidate: "b".repeat(40),
    producerScript: "acceptance:runtime-log-spine:real-proof",
  };
  const payload = {
    schema_version: "governance-dynamic-observation.v2", proof_run_id: binding.proofRunId,
    candidate: binding.candidate, captured_at: "2026-08-28T00:00:00.000Z", lawId: binding.lawId,
    evidenceMode: binding.evidenceMode, clauses: binding.clauses, observed_value: binding.observedValue,
    producer_script: binding.producerScript, observation_kind: "browser",
    observation: { browserVersion: "Chromium 1", endpoint: "https://chatgpt.com/", pageTitle: "ChatGPT",
      facts: { runtime_log_browser_span_count: 39 }, sessionFacts: { authorityState: "present" } },
  };
  assert.equal(validateDynamicReceiptPayload(payload, binding), true);
});

test("Dynamic Proof routes are separated by native Owner", () => {
  const proof = readFileSync("scripts/acceptance/agent-production-runtime.real-proof.ts", "utf8");
  assert.equal(proof.includes("proofDurationMs"), false);
  assert.equal(proof.includes('evidenceMode: "dynamic.performance"'), false);
  for (const forbidden of [
    "GRASSEYE_GPT_DYNAMIC_PROOF_PATH", "agent-production-runtime-gpt-dynamic-proof.v1",
    "same_job_id", "zero_replayed_mutations", "checkpoint_before_hash", "candidate_hash",
    ".catch(() => undefined)", "cleanupVerified: true", "dynamic.recovery",
    "old_attempt_after_restart_rejected", "new_attempt_fresh_started",
  ]) assert.equal(proof.includes(forbidden), false, forbidden);
  for (const token of ["LAW-AGENT-PRODUCTION-RUNTIME-001-V66", "runtime_schema_exact", "runtime_orphan_directory_count",
    "AGENT_RUNTIME_OWNER_ISOLATED_RELEASE_PROOF_NOT_ADMITTED"]) assert.ok(proof.includes(token), token);
  for (const adjacentPrefix of ["LAW-GPT-", "LAW-LOCAL-BROWSER-SESSION-", "LAW-RUNTIME-LOG-SPINE-"]) {
    assert.equal(proof.includes(adjacentPrefix), false, adjacentPrefix);
  }
  for (const [file, sentinel] of [
    ["scripts/acceptance/gpt.real-proof.ts", "GPT_OWNER_ISOLATED_RELEASE_PROOF_NOT_ADMITTED"],
    ["scripts/acceptance/local-browser.real-proof.ts", "LOCAL_BROWSER_OWNER_ISOLATED_RELEASE_PROOF_NOT_ADMITTED"],
    ["scripts/acceptance/runtime-log-spine.real-proof.ts", "RUNTIME_LOG_OWNER_ISOLATED_RELEASE_PROOF_NOT_ADMITTED"],
  ] as const) assert.ok(readFileSync(file, "utf8").includes(sentinel), file);
  assert.equal(dynamicScriptFor("gpt", "dynamic.provider"), "acceptance:gpt:real-proof");
  assert.equal(dynamicScriptFor("local-browser-session", "dynamic.browser"),
    "acceptance:local-browser:real-proof");
  assert.equal(dynamicScriptFor("local-browser-session", "dynamic.storage"),
    "acceptance:local-browser:real-proof");
  assert.equal(dynamicScriptFor("runtime-log-spine", "dynamic.service"),
    "acceptance:runtime-log-spine:real-proof");
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
    "acceptance:architecture-boundary",
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
