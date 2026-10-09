import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Project, SyntaxKind } from "ts-morph";

import {
  inspectAgentProductionRuntime,
} from "../audit/domains/agent-production-runtime/inspector.js";
import { inspectAgentContracts, runtimeManifestOwnershipDrift } from
  "../audit/domains/agent-production-runtime/contract-inspection.js";
import { buildRegistry } from "../audit/governance-authority.js";
import { computeTargetPaths } from "../audit/shared/quality-runner.js";
import { createAuditProject } from "../audit/shared/project.js";
import { workerLoopStopViolations } from
  "../audit/domains/agent-production-runtime/worker-loop-inspection.js";
import { workerLoop } from "../../src/lib/local-runtime/production/runtime-loops.js";
import type { RuntimeState } from "../../src/lib/local-runtime/production/runtime-state.js";
import { reconcileClaimAttemptFailure } from "../../src/lib/local-runtime/production/runtime-claim-recovery.js";
import { buildProductionLeaseRelease } from "../../src/lib/local-runtime/production/cloud-client.js";
import { serializeTerminalFailure, type SerializedTerminalFailure } from "../../src/lib/local-runtime/production/terminal-failure.js";
import { executionFailure } from "../../src/lib/execution-failure.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { claimTask, task, failureStatus } from "./agent-production-runtime-fixtures.js";
import { ClaimedProductionTaskSchema } from "../../src/lib/local-runtime/production/transport-protocol.js";

const readRuntimeSource = (relativePath: string) => readFile(
  new URL(`../../src/lib/local-runtime/production/${relativePath}`, import.meta.url), "utf8",
);

const riskRecoveryFixture = () => {
  const job = claimTask(task({ jobId: "job:zero-risk-regrant", productId: "payment_screenshot_observation", actionId: "observe" }));
  const seal = hashCanonical("signed-source");
  const callIdentity = { product_step_id: "observe", call_id: "turn-submit", child_capability_id: "submit_exact_gpt_turn_once",
    source_effect_set_hash: hashCanonical("effect-set") };
  const replayIdentity = { source_seal_hash: seal, source_attempt_id: "attempt:prior", result_revision: 6 };
  const call = { ...callIdentity, call_grant_hash: hashCanonical({ job_id: job.job_id,
    attempt_id: job.grant.attempt_id, ...replayIdentity, ...callIdentity }) };
  const replayBody = { ...replayIdentity, calls: [call] };
  const grant = { ...job.grant, result_revision: 6, source_handoff_seal_hash: seal,
    same_accepted_attempt: true, delivery_priority_replay_grant: { ...replayBody,
      grant_hash: hashCanonical({ job_id: job.job_id, attempt_id: job.grant.attempt_id, ...replayBody }) } };
  const claimed = ClaimedProductionTaskSchema.parse({ ...job, grant });
  const session = { workerSessionId: job.grant.worker_session_id, workerSessionEpoch: job.grant.worker_session_epoch };
  const core: SerializedTerminalFailure = { ...serializeTerminalFailure(executionFailure("failed", "BROWSER_TARGET_INVALID")),
    provider_effect_identity_hash: null, settled_result_payload_hash: null };
  const failure = { failure_core: core, release_descriptor: buildProductionLeaseRelease(session, claimed, {
    reasonCode: "ATTEMPT_FAILED", attemptFailure: core }).descriptor };
  const effects = Array.from({ length: 6 }, (_, index) => ({ attemptId: `attempt:old-${index}`, resultRevision: index,
    state: "REJECTED" as const, mutationOutcome: "confirmed" as const, physicalInputCount: 1,
    productStepId: call.product_step_id, callId: call.call_id, childCapabilityId: call.child_capability_id,
    sourceEffectSetHash: call.source_effect_set_hash, effectIdentityHash: hashCanonical(`effect:${index}`),
    authorityRef: `browser:${index}`, walAuthorityHash: hashCanonical(`wal:${index}`),
    rawWalAuthorityHash: hashCanonical(`wal:${index}`), anchorState: "absent" as const,
    anchorProofHash: hashCanonical(`anchor:${index}`) }));
  const history = { historyHash: hashCanonical(effects), rowCount: 42, walHistoryVerified: true,
    unresolvedCommandCount: 0, unresolvedCommandSetHash: hashCanonical([]), replayCalls: [], replayEffects: effects };
  const settlements = effects.map(effect => ({ kind: "risk_authorized" as const,
    effectIdentityHash: effect.effectIdentityHash, sourceEffectSetHash: effect.sourceEffectSetHash,
    productStepId: effect.productStepId, callId: effect.callId, childCapabilityId: effect.childCapabilityId,
    sourceAnchorState: effect.anchorState, sourceWalAuthorityHash: effect.walAuthorityHash,
    sourceAnchorProofHash: effect.anchorProofHash, sourceHandoffSealHash: seal }));
  const remote = failureStatus(job.job_id, { ...core, attempt_id: grant.attempt_id,
    lease_version: grant.lease_version, from_status: "failed", to_status: "failed" }, []);
  return { claimed, session, failure, history, settlements, remote, seal };
};

const exerciseRiskGrantZeroInputRegrant = async (): Promise<void> => {
  const fixture = riskRecoveryFixture();
  const { claimed, failure, history, settlements, remote, seal } = fixture;
  const originalCore = JSON.stringify(failure.failure_core);
  let inputState = "zero", provenance = true, unresolved = 0, drift = false, badSource = false, reads = 0, anchorDrift = false;
  let emptyEffects = false;
  let accepted = settlements, recorded = failure;
  let zeroProof: Readonly<{ productStepId: string; callId: string; childCapabilityId: string; grantHash: string }> | null = null;
  const state = { session: fixture.session, store: {
    readTask: () => ({ current_attempt_id: claimed.grant.attempt_id, attempt_failure: recorded }),
    readAttemptFailureRaw: () => JSON.stringify(failure),
    readIssuedSourceHandoff: (jobId: string, attemptId: string, hash: string) => {
      assert.deepEqual([jobId, attemptId, hash], [claimed.job_id, claimed.grant.attempt_id, seal]);
      return badSource ? null : { kind: "delivery_priority_replay" };
    }, readAcceptedSourceSettlements: () => accepted,
  }, browserAuthority: {
    readAttemptPhysicalInputState: () => inputState,
    readJobBrowserHistoryEvidence: () => {
      const second = ++reads % 2 === 0;
      return { ...history, walHistoryVerified: provenance, unresolvedCommandCount: unresolved,
        rowCount: emptyEffects ? 0 : history.rowCount,
        historyHash: emptyEffects ? hashCanonical([]) : drift && second ? hashCanonical("drift") : history.historyHash,
        replayEffects: emptyEffects ? [] : anchorDrift && second ? history.replayEffects.map(effect =>
          ({ ...effect, anchorProofHash: hashCanonical("changed-anchor") })) : history.replayEffects };
    }, readProvenZeroInputProviderCommand: () => zeroProof,
  } } as unknown as RuntimeState;
  const execute = (candidate = claimed, status = remote) => reconcileClaimAttemptFailure(state, candidate,
    status as never, "parent", async () => { throw new Error("FORBIDDEN_SECOND_RELEASE"); });
  assert.equal((await execute()).stopBeforeProduct, false,
    "null diagnostic scope cannot override the current zero proof and six signed historical settlements");
  for (const variant of ["possible", "unknown", "provenance", "unresolved", "drift", "anchor", "source", "settlement", "empty-settlements", "empty-effects"]) {
    inputState = variant === "possible" || variant === "unknown" ? variant : "zero";
    provenance = variant !== "provenance"; unresolved = variant === "unresolved" ? 1 : 0;
    drift = variant === "drift"; anchorDrift = variant === "anchor"; reads = 0; badSource = variant === "source";
    emptyEffects = variant === "empty-effects";
    accepted = variant === "settlement" ? settlements.slice(1) : variant === "empty-settlements" ? [] : settlements;
    await assert.rejects(execute, /PRODUCTION_SOURCE_HANDOFF_REQUIRED/u, variant);
  }
  inputState = "zero"; provenance = true; unresolved = 0; drift = false; anchorDrift = false; badSource = false; accepted = settlements;
  emptyEffects = false;
  await assert.rejects(() => execute({ ...claimed, grant: { ...claimed.grant, same_accepted_attempt: false } }), /PRODUCTION_SOURCE_HANDOFF_REQUIRED/u);
  await assert.rejects(() => execute(claimed, { ...remote, next_action_code: "RECONCILE" }), /PRODUCTION_CLAIM_AFTER_FAILURE_NEXT_ACTION_INVALID/u);
  const providerCore = { ...failure.failure_core, effect_scope: "provider_effect" as const, browser_outcome: "REJECTED" as const,
    mutation_outcome: "no" as const, provider_effect_identity_hash: hashCanonical("current-zero-effect"),
    evidence_ref: "browser:current-zero", evidence_hash: hashCanonical("current-zero-authority") };
  recorded = { failure_core: providerCore, release_descriptor: buildProductionLeaseRelease(fixture.session, claimed,
    { reasonCode: "ATTEMPT_FAILED", attemptFailure: providerCore }).descriptor };
  const providerRemote = failureStatus(claimed.job_id, { ...providerCore, attempt_id: claimed.grant.attempt_id,
    lease_version: claimed.grant.lease_version, from_status: "failed", to_status: "failed" }, []);
  await assert.rejects(() => execute(claimed, providerRemote), /PRODUCTION_SOURCE_HANDOFF_REQUIRED/u);
  const authorized = claimed.grant.delivery_priority_replay_grant!.calls[0]!;
  zeroProof = { productStepId: authorized.product_step_id, callId: authorized.call_id,
    childCapabilityId: authorized.child_capability_id, grantHash: authorized.call_grant_hash };
  assert.equal((await execute(claimed, providerRemote)).stopBeforeProduct, false);
  zeroProof = { ...zeroProof, grantHash: hashCanonical("wrong-grant") };
  await assert.rejects(() => execute(claimed, providerRemote), /PRODUCTION_SOURCE_HANDOFF_REQUIRED/u);
  assert.equal(JSON.stringify(failure.failure_core), originalCore, "regrant never patches the immutable first fact");
};

const WORKER_LOOP_DELAY_STATEMENT = "delay = Math.min(30_000, Math.max(1_000, delay * 2));";
const WORKER_LOOP_WAIT_STATEMENT = "await wait(delay, state.abort.signal);";
const WORKER_LOOP_ITERATION_STATEMENT = "delay = await workerIteration(state);";

const inspectRuntimeSources = (project: Project, queryRef: string) => {
  const findings: Parameters<typeof inspectAgentProductionRuntime>[1] = [];
  inspectAgentProductionRuntime({
    project,
    sealedRoot: path.resolve("."),
    selectedLawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V75",
    targetSet: { queryRef, count: project.getSourceFiles().length },
    targetPaths: project.getSourceFiles().map((source) => path.relative(path.resolve("."), source.getFilePath()).replaceAll("\\", "/")),
    lawRequirements: [],
    planEntry: {
      capabilityDomain: "agent-production-runtime",
      manifestPath: "scripts/audit/domains/agent-production-runtime/manifest.json",
      ownerInspectorPath: "scripts/audit/domains/agent-production-runtime/inspector.ts",
      executionGroup: "domain",
      lawIds: ["LAW-AGENT-PRODUCTION-RUNTIME-001-V75"],
    },
    generatedPlan: [],
  }, findings);
  return findings;
};

const exerciseLifecycleMutant = (): void => {
  const project = new Project({ tsConfigFilePath: path.resolve("tsconfig.json") });
  const outbox = project.getSourceFileOrThrow(path.resolve(
    "src/lib/local-runtime/production/store-outbox.ts",
  ));
  outbox.replaceWithText(outbox.getFullText().replace(
    'executionFailure("failed", authority.lastError)',
    'executionFailure("failed", "PRODUCTION_OUTBOX_ATTEMPT_ENDED")',
  ));
  assert.ok(inspectRuntimeSources(project, "acceptance:runtime-lifecycle-mutant").some((finding) =>
    finding.checkId === "agent-production-runtime/no-local-business-lifecycle-adjudication"),
  "an Outbox mutant that converts a delivery fact into attempt-ended must fail closed");
  const loops = project.getSourceFileOrThrow(path.resolve("src/lib/local-runtime/production/runtime-loops.ts"));
  loops.replaceWithText(loops.getFullText().replace(WORKER_LOOP_DELAY_STATEMENT,
    `${WORKER_LOOP_DELAY_STATEMENT}\n      return;`));
  assert.ok(inspectRuntimeSources(project, "acceptance:runtime-worker-loop-mutant").some((finding) =>
    finding.checkId === "agent-production-runtime/worker-loop-stops-on-failure"),
  "the Runtime inspector must be wired to reject a workerLoop that returns after an iteration failure");
};

const exerciseAuthorityGuardMutants = (): void => {
  const project = new Project({ tsConfigFilePath: path.resolve("tsconfig.json") });
  assert.deepEqual(inspectRuntimeSources(project, "acceptance:runtime-authority-baseline"), []);
  const guardCases = [
    ["runtime-business-admission", "BUSINESS_ADMISSION_RESULT_HASH_MISMATCH", "admission-before-completion"],
    ["executor", "PRODUCTION_PARENT_RESULT_BINDING_INVALID", "completed-parent-exact-locator"],
  ] as const;
  for (const [file, code, check] of guardCases) {
    const source = project.getSourceFileOrThrow(path.resolve(`src/lib/local-runtime/production/${file}.ts`));
    const original = source.getFullText();
    const guard = source.getDescendantsOfKind(SyntaxKind.IfStatement)
      .find((statement) => statement.getThenStatement().getText().includes(code));
    assert.ok(guard, "the actual rejecting authority branch must exist");
    guard!.setExpression(`false && (${guard!.getExpression().getText()})`);
    assert.ok(inspectRuntimeSources(project, "acceptance:disabled-authority-guard").some((finding) =>
      finding.checkId === `agent-production-runtime/${check}`));
    source.replaceWithText(original);
  }
  const renewal = project.getSourceFileOrThrow(path.resolve("src/lib/local-runtime/production/runtime-execution-heartbeat.ts"));
  const originalRenewal = renewal.getFullText();
  renewal.replaceWithText(originalRenewal.replace("  const transport = typedRuntimeTransportFailure(error);",
    "  if (typedRuntimeTransportFailure(error)?.httpStatus === 409) return true;\n  const transport = typedRuntimeTransportFailure(error);"));
  assert.notEqual(renewal.getFullText(), originalRenewal);
  assert.ok(inspectRuntimeSources(project, "acceptance:renewal-4xx-retry").some((finding) =>
    finding.checkId === "agent-production-runtime/same-lease-monotonic-renewal"));
  renewal.replaceWithText(originalRenewal);
  const taskState = project.getSourceFileOrThrow(path.resolve("src/lib/local-runtime/production/store-task-state.ts"));
  const originalTaskState = taskState.getFullText();
  const immutable = taskState.getClassOrThrow("ProductionStoreTaskState").getMethodOrThrow("recordAttemptFailure")
    .getDescendantsOfKind(SyntaxKind.IfStatement).find((statement) =>
      statement.getThenStatement().getText().includes("PRODUCTION_ATTEMPT_FAILURE_IMMUTABLE"));
  assert.ok(immutable);
  immutable!.remove();
  assert.ok(taskState.getFullText().includes("attempt_failure_json=coalesce(attempt_failure_json,?)"));
  taskState.replaceWithText(taskState.getFullText().replace("attempt_failure_json=coalesce(attempt_failure_json,?)", "attempt_failure_json=?"));
  assert.ok(inspectRuntimeSources(project, "acceptance:first-fact-overwrite").some((finding) =>
    finding.checkId === "agent-production-runtime/immutable-first-fact-cas"));
  taskState.replaceWithText(originalTaskState);
  assert.deepEqual(inspectRuntimeSources(project, "acceptance:runtime-authority-restored"), []);
};

const exerciseProviderAndOpaqueRouteMutants = (): void => {
  const registry = buildRegistry();
  const targetPaths = [...new Set(registry.laws.filter((law) => law.capabilityDomain === "agent-production-runtime")
    .flatMap((law) => computeTargetPaths(law, registry)))].sort();
  const project = createAuditProject(process.cwd(), targetPaths);
  const context = { project, sealedRoot: process.cwd(), targetPaths } as never;
  const findings: Parameters<typeof inspectAgentContracts>[1] = [];
  inspectAgentContracts(context, findings);
  inspectAgentProductionRuntime(context, findings);
  assert.equal(findings.length, 0, "the actual Native Runtime scope must establish the original contracts");
  const generator = project.getSourceFileOrThrow(path.resolve("scripts/generate/sync-website-agent-route-policy-projection.ts"));
  const originalGenerator = generator.getFullText();
  generator.getVariableDeclarationOrThrow("bytes").setInitializer("await readFile(destination)");
  findings.length = 0;
  inspectAgentContracts(context, findings);
  assert.ok(findings.some((finding) => finding.checkId === "agent-production-runtime/provider-generator"),
    "consumer self-reading must not masquerade as the Website provider source");
  generator.replaceWithText(originalGenerator);
  const contracts = project.getSourceFileOrThrow(path.resolve("src/lib/local-runtime/production/contracts.ts"));
  const originalContracts = contracts.getFullText();
  const product = contracts.getVariableDeclarationOrThrow("ProductionProductIdSchema");
  product.setInitializer(`${product.getInitializerOrThrow().getText()}.refine(value => value === "bazi_ai_full_analysis")`);
  findings.length = 0;
  inspectAgentProductionRuntime(context, findings);
  assert.ok(findings.some((finding) => finding.checkId === "agent-production-runtime/opaque-product-action"),
    "a bounded transport string cannot gain a second business product selector");
  contracts.replaceWithText(originalContracts);
  findings.length = 0;
  inspectAgentContracts(context, findings);
  inspectAgentProductionRuntime(context, findings);
  assert.deepEqual(findings, [], "ordinary in-memory mutants must leave the original Native scope intact");
};

const exerciseWorkerLoopSurvivesIterationFailure = async (): Promise<void> => {
  const controller = new AbortController();
  const observed: Record<string, unknown> = { abort: controller };
  const state = new Proxy(observed as RuntimeState, {
    get: (target, property) => {
      if (property === "abort") return target.abort;
      throw new Error("INJECTED_ITERATION_FAILURE");
    },
  });
  let ended = false;
  const running = workerLoop(state).then(() => { ended = true; });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(observed.lastErrorCode, "PRODUCTION_RUNTIME_FAILED");
  assert.equal(observed.lastErrorReason, "INJECTED_ITERATION_FAILURE");
  assert.equal(ended, false, "an ordinary iteration failure must return to the loop and its bounded wait");
  controller.abort();
  await running;
  assert.equal(ended, true, "only the abort signal may end the worker loop");
};

const exerciseWorkerLoopStopMutants = async (): Promise<void> => {
  const loopsText = await readRuntimeSource("runtime-loops.ts");
  const violationsOf = (text: string): readonly string[] => workerLoopStopViolations(
    new Project({ useInMemoryFileSystem: true }).createSourceFile("runtime-loops.ts", text)
      .getVariableDeclaration("workerLoop")?.getInitializer());
  assert.deepEqual(violationsOf(loopsText), []);
  const inCatch = (statement: string): string =>
    loopsText.replace(WORKER_LOOP_DELAY_STATEMENT, `${WORKER_LOOP_DELAY_STATEMENT}\n      ${statement}`);
  const inTry = (statement: string): string =>
    loopsText.replace(WORKER_LOOP_ITERATION_STATEMENT, `${WORKER_LOOP_ITERATION_STATEMENT}\n      ${statement}`);
  const benign: ReadonlyArray<readonly [string, string]> = [
    ["a diagnostic log call in the catch", inCatch("logWorkerFailure(error);")],
    ["a metrics call in the catch", inCatch('metrics.increment("worker.iteration_failed");')],
    ["a callback with its own return in the catch", inCatch("[1].forEach((count) => { return count; });")],
    ["an inner loop that breaks in the try", inTry("for (const item of []) { if (item) break; }")],
    ["a throw that stays inside the try", inTry('if (state === undefined) throw new Error("caught by the catch");')],
    ["a statement after the bounded wait",
      loopsText.replace(WORKER_LOOP_WAIT_STATEMENT, `${WORKER_LOOP_WAIT_STATEMENT}\n    state.lastHeartbeat = state.lastHeartbeat;`)],
  ];
  for (const [label, text] of benign) {
    assert.notEqual(text, loopsText, `${label} must actually change runtime-loops.ts`);
    assert.deepEqual(violationsOf(text), [], `${label} does not change the control flow and must not be frozen`);
  }
  const mutants: ReadonlyArray<readonly [string, string]> = [
    ["a return in the catch", inCatch("return;")],
    ["a break in the catch", inCatch("break;")],
    ["a continue in the catch", inCatch("continue;")],
    ["a rethrow in the catch", inCatch("throw error;")],
    ["an unauthorised abort in the catch", inCatch("state.abort.abort();")],
    ["a stop flag in the catch", inCatch("state.stopped = true;")],
    ["a draining flag in the catch", inCatch("state.draining = true;")],
    ["a process exit in the catch", inCatch("process.exit(1);")],
    ["a return on the success path", inTry("if (delay > 0) return;")],
    ["a continue that skips the wait", inTry("if (delay > 0) continue;")],
    ["a workerLoop without its bounded wait", loopsText.replace(WORKER_LOOP_WAIT_STATEMENT, "")],
    ["an unbounded delay", loopsText.replace(WORKER_LOOP_DELAY_STATEMENT, "delay = delay * 2;")],
    ["a raised delay ceiling", loopsText.replace(WORKER_LOOP_DELAY_STATEMENT,
      "delay = Math.min(3_600_000, Math.max(1_000, delay * 2));")],
    ["a loop that is no longer bounded by the abort signal",
      loopsText.replace("while (!state.abort.signal.aborted) {\n    try {", "while (true) {\n    try {")],
  ];
  for (const [label, mutant] of mutants) {
    assert.notEqual(mutant, loopsText, `${label} must actually change runtime-loops.ts`);
    assert.ok(violationsOf(mutant).length > 0, `${label} must fail the worker loop inspection`);
  }
};

const exerciseManifestAndLawOwnership = async (): Promise<void> => {
  const runtimeManifest = JSON.parse(await readFile(
    new URL("../audit/domains/agent-production-runtime/manifest.json", import.meta.url), "utf8",
  )) as { ownedPaths: string[] };
  assert.deepEqual(runtimeManifestOwnershipDrift(runtimeManifest.ownedPaths), []);
  assert.deepEqual(runtimeManifestOwnershipDrift([
    ...runtimeManifest.ownedPaths,
    "src/mediator/agent-production-route.ts",
    "src/plugins/**",
  ]), ["src/mediator/agent-production-route.ts", "src/plugins/**"]);
  assert.deepEqual(runtimeManifestOwnershipDrift([
    "docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md",
    "docs/specs/agent-production-runtime/**",
    "scripts/acceptance/agent-production-runtime.acceptance.ts",
    "scripts/audit/domains/agent-production-runtime/**",
    "src/lib/local-runtime/production/**",
  ]), []);

  const runtimeLawSource = await readFile(
    new URL("../../.github/instructions/agent-rules/功能法案.md", import.meta.url), "utf8",
  );
  const runtimeLawRecords = [...runtimeLawSource.matchAll(/```law-record\n([\s\S]*?)\n```/gu)]
    .map((match) => JSON.parse(match[1]!) as { lawId: string; forbidden: string[] });
  const runtimeCoreLaw = runtimeLawRecords.find(
    (record) => record.lawId === "LAW-AGENT-PRODUCTION-RUNTIME-001-V75",
  );
  assert.ok(runtimeCoreLaw);
  for (const token of [
    "只有 Website.ai-acceptance",
    "Runtime 直接读取 Browser 私有 WAL",
    "第二 Outbox",
    "第二 state machine",
  ]) assert.ok(runtimeCoreLaw.forbidden.some((entry) => entry.includes(token)), token);
};

const assertClaimAndAdmissionSourceBoundaries = (
  runtimeSource: string, runtimeLoopsSource: string, workerSessionSource: string,
  cloudClientSource: string, executorSource: string,
): void => {
  assert.doesNotMatch(runtimeSource, /outcome: "failed"[\s\S]{0,300}BUSINESS_ADMISSION_PENDING/u);
  assert.doesNotMatch(runtimeLoopsSource, /outcome: "failed"[\s\S]{0,300}BUSINESS_ADMISSION_PENDING/u);
  assert.match(runtimeLoopsSource,
    /component: "production-admission-readback"[\s\S]{0,120}operation: "website\.v6-request"/u);
  assert.match(runtimeLoopsSource,
    /recoveryOnlyClaim = availableNewSlots <= 0 && hasExistingAttemptRecovery/u);
  assert.match(runtimeLoopsSource,
    /Math\.max\(1, availableNewSlots\), recoveryOnlyClaim/u);
  assert.match(workerSessionSource,
    /forceCurrentAttestation[\s\S]{0,180}\? await this\.performHeartbeat\(\)/u);
  assert.match(cloudClientSource,
    /requestClaim\(requestId, limit, forceCurrentAttestation,\s*sourceEvidence, deliveryCandidates\)/u);
  assert.doesNotMatch(runtimeLoopsSource,
    /operation: "website\.result-consume"[\s\S]{0,900}reconcileBusinessAdmission/u);
  assert.match(runtimeLoopsSource,
    /span\.terminal\(outcome === "completed"[\s\S]{0,260}: \{ outcome: "succeeded" \}\)/u);
  assert.doesNotMatch(runtimeSource, /emitState|stateKey:|currentStates|reconciledFromAuthority/u);
  assert.doesNotMatch(executorSource, /runTurn|ProductionGptExecutor|GPT_TURN_FLOW/u);
  assert.match(executorSource, /gpt: gptExecution\.tools/u);
};

export const exerciseProductionRuntimeSourceBoundaries = async (): Promise<void> => {
  await exerciseRiskGrantZeroInputRegrant();
  const [runtimeSource, runtimeStartupSource, businessAdmissionSource, runtimeLoopsSource,
    outboxSource, storeFoundationSource, reconciliationSource, executorSource, storeSource,
    workerSessionSource, cloudClientSource] =
    await Promise.all([
      readRuntimeSource("runtime-claim.ts"),
      readRuntimeSource("runtime-startup.ts"),
      readRuntimeSource("runtime-business-admission.ts"),
      readRuntimeSource("runtime-loops.ts"),
      readRuntimeSource("store-outbox.ts"),
      readRuntimeSource("store-foundation.ts"),
      readRuntimeSource("cloud-reconciliation-client.ts"),
      readRuntimeSource("executor.ts"),
      readRuntimeSource("store-task-state.ts"),
      readRuntimeSource("worker-session.ts"),
      readRuntimeSource("cloud-client.ts"),
    ]);
  assertClaimAndAdmissionSourceBoundaries(
    runtimeSource, runtimeLoopsSource, workerSessionSource, cloudClientSource, executorSource,
  );
  const executeClaimSource = runtimeSource.slice(runtimeSource.indexOf("export const executeClaim"));
  const executionFailureSource = runtimeSource.slice(
    runtimeSource.indexOf("const handleProductExecutionFailure"),
    runtimeSource.indexOf("export const executeClaim"),
  );
  assert.doesNotMatch(storeSource, /attempt_failure_json=null,current_reason='LEASE_REGRANTED'/u);
  assert.doesNotMatch(storeSource, /stageResultAfterProviderEffectReadback/u);
  assert.doesNotMatch(storeSource,
    /acceptTaskAfterSourceHandoff[\s\S]*?current_reason !== `SOURCE_HANDOFF_SEALED/u);
  assert.match(storeSource,
    /acceptTaskAfterSourceHandoff[\s\S]*?archived\.sealed_at === null/u);
  assert.doesNotMatch(executeClaimSource, /recoverAcceptedClaim|reconcileStaleFenceCheckpoint/u);
  const mismatchBranch = executionFailureSource.indexOf(
    'code === "BROWSER_GPT_DIALOG_UNRECOGNIZED"',
  );
  const persistFailure = executionFailureSource.indexOf("await persistAttemptFailure", mismatchBranch);
  assert.ok(mismatchBranch >= 0 && persistFailure > mismatchBranch);
  assert.match(executionFailureSource.slice(mismatchBranch, persistFailure),
    /setCurrentReason\(job\.job_id, "BROWSER_GPT_DIALOG_UNRECOGNIZED"\)[\s\S]*return;/u);
  assert.doesNotMatch(outboxSource, /recoverCheckpointPrefix|deliverReauthorizedStaleCheckpoint/u);
  assert.doesNotMatch(runtimeStartupSource, /PROCESS_RESTART_ATTEMPT_ENDED|endUnsentAttemptWrites/u);
  assert.doesNotMatch(runtimeSource, /ATTEMPT_ENDED:/u);
  assert.doesNotMatch(businessAdmissionSource, /discardStagedResult|ATTEMPT_ENDED/u);
  assert.doesNotMatch(storeSource, /discardStagedResult/u);
  assert.match(executorSource, /abort_signal\.aborted[\s\S]{0,220}PRODUCTION_EXECUTION_ABORTED/u);
  assert.doesNotMatch(executorSource, /reconcilePermanentCancellation/u);
  assert.doesNotMatch(storeSource, /Continuation|Checkpoint/u);
  assert.match(reconciliationSource, /V6_DEVICE_JOB_CONTROL_AUTHORITY_INVALID/u);
  assert.match(businessAdmissionSource, /websiteJobAbsent/u);
  assert.match(businessAdmissionSource, /purgeDeletedJob/u);
  assert.match(runtimeSource, /purgeDeletedJob/u);
  assert.doesNotMatch(runtimeLoopsSource, /BrowserQuarantine|reconcilePermanentlyRevokedTargetLocal/u);
  assert.doesNotMatch(runtimeLoopsSource, /flushOutbox|pendingOutbox\(\)|sendProductionOutboxWrite/u);
  assert.match(storeSource, /supersedeUnsentWritesForWebsiteAttempt/u);
  assert.match(storeSource, /WEBSITE_ATTEMPT_REPLACED/u);
  assert.doesNotMatch(`${storeSource}\n${outboxSource}`, /ATTEMPT_ENDED|PRODUCTION_OUTBOX_ATTEMPT_ENDED/u);
  assert.match(outboxSource, /executionFailure\("failed", authority\.lastError\)/u);
  exerciseLifecycleMutant();
  exerciseAuthorityGuardMutants();
  exerciseProviderAndOpaqueRouteMutants();
  await exerciseWorkerLoopStopMutants();
  await exerciseWorkerLoopSurvivesIterationFailure();
  assert.match(storeSource, /purgeJob\(jobId: string\)/u);
  assert.match(storeSource, /delete from production_outbox/u);
  assert.match(outboxSource,
    /sent_at is null[\s\S]{0,120}last_error is null or \(kind='provider_cooldown'/u);
  assert.doesNotMatch(`${storeFoundationSource}\n${outboxSource}`,
    /next_delivery_at|nextDeliveryAt|pendingOutbox\(/u);
  await exerciseManifestAndLawOwnership();
};
