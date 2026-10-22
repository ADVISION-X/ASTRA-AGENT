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
import { riskRecoveryFixture } from "./agent-production-runtime-payload-slot.acceptance-support.js";

const readRuntimeSource = (relativePath: string) => readFile(
  new URL(`../../src/lib/local-runtime/production/${relativePath}`, import.meta.url), "utf8",
);

const exerciseAcknowledgedFailureRegrant = async (): Promise<void> => {
  const fixture = riskRecoveryFixture();
  const { failure, remote } = fixture;
  const claimed = { ...fixture.claimed, grant: { ...fixture.claimed.grant,
    source_handoff_seal_hash: null, delivery_priority_replay_grant: null } };
  const original = JSON.stringify(failure);
  const state = { session: fixture.session, store: {
    readTask: () => ({ task: fixture.base, status: "failed",
      current_attempt_id: claimed.grant.attempt_id, attempt_failure: failure }),
    readAttemptFailureRaw: () => original,
  } } as never;
  const execute = (candidate = claimed, status = remote) => reconcileClaimAttemptFailure(state, candidate,
    status, "parent", async () => { throw new Error("FORBIDDEN_SECOND_RELEASE"); });
  const result = await execute();
  assert.equal(result.stopBeforeProduct, false,
    "Website acknowledged the first fact and regranted the current attempt");
  assert.equal(JSON.stringify(result.reconciledFailure), original,
    "regrant preserves the immutable first fact");
  await assert.rejects(() => execute({ ...claimed, grant: { ...claimed.grant, attempt_id: "wrong-attempt" } }),
    /PRODUCTION_ATTEMPT_FAILURE_AUTHORITY_MISSING/u);
  await assert.rejects(() => execute(claimed, { ...remote, next_action_code: "WAIT_NEW_ATTEMPT" }),
    /PRODUCTION_CLAIM_AFTER_FAILURE_NEXT_ACTION_INVALID/u);
  assert.equal(JSON.stringify(failure), original);
};

const WORKER_LOOP_DELAY_STATEMENT = "delay = Math.min(30_000, Math.max(1_000, delay * 2));";
const WORKER_LOOP_WAIT_STATEMENT = "await wait(delay, state.abort.signal);";
const WORKER_LOOP_ITERATION_STATEMENT = "delay = await state.iteration;";

const inspectRuntimeSources = (project: Project, queryRef: string) => {
  const findings: Parameters<typeof inspectAgentProductionRuntime>[1] = [];
  inspectAgentProductionRuntime({
    project,
    sealedRoot: path.resolve("."),
    selectedLawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V78",
    targetSet: { queryRef, count: project.getSourceFiles().length },
    targetPaths: project.getSourceFiles().map((source) => path.relative(path.resolve("."), source.getFilePath()).replaceAll("\\", "/")),
    lawRequirements: [],
    planEntry: {
      capabilityDomain: "agent-production-runtime",
      manifestPath: "scripts/audit/domains/agent-production-runtime/manifest.json",
      ownerInspectorPath: "scripts/audit/domains/agent-production-runtime/inspector.ts",
      executionGroup: "domain",
      lawIds: ["LAW-AGENT-PRODUCTION-RUNTIME-001-V78"],
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
  const loops = project.getSourceFileOrThrow(path.resolve("src/lib/local-runtime/production/runtime-loops.ts"));
  const originalLoops = loops.getFullText();
  for (const mutation of [
    originalLoops.replace("if (state.store.hasUnsentOutbox(jobId)) continue;", "if (false && state.store.hasUnsentOutbox(jobId)) continue;"),
    originalLoops.replace("for (const jobId of state.store.pendingBrowserCleanupJobIds())", "for (const jobId of state.store.pendingBrowserCleanupJobIds().slice(0, 1))"),
  ]) {
    assert.notEqual(mutation, originalLoops); loops.replaceWithText(mutation);
    assert.ok(inspectRuntimeSources(project, "acceptance:cleanup-own-job-and-finite-sweep").some(finding =>
      finding.checkId === "agent-production-runtime/delivery-before-cleanup"));
  }
  loops.replaceWithText(originalLoops);
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
      if (property === "abort" || property === "iteration") return Reflect.get(target, property);
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
    "docs/项目方案/旧交付记录账本误阻断-完整实现方案.md",
    "docs/specs/agent-production-runtime/**",
    "scripts/acceptance/agent-production-runtime.acceptance.ts",
    "scripts/audit/domains/agent-production-runtime/**",
    "src/lib/local-runtime/production/**",
  ]), []);
  assert.deepEqual(runtimeManifestOwnershipDrift([
    "docs/项目方案/相邻产品-完整实现方案.md",
    "docs/项目方案/AGENT原attempt无失败事实恢复-完整实现方案.md",
  ]), ["docs/项目方案/相邻产品-完整实现方案.md", "docs/项目方案/AGENT原attempt无失败事实恢复-完整实现方案.md"],
  "the current Runtime plan must not grant ownership over other or historical schemes");

  const runtimeLawSource = await readFile(
    new URL("../../.github/instructions/agent-rules/功能法案.md", import.meta.url), "utf8",
  );
  const runtimeLawRecords = [...runtimeLawSource.matchAll(/```law-record\n([\s\S]*?)\n```/gu)]
    .map((match) => JSON.parse(match[1]!) as { lawId: string; forbidden: string[] });
  const runtimeCoreLaw = runtimeLawRecords.find(
    (record) => record.lawId === "LAW-AGENT-PRODUCTION-RUNTIME-001-V78",
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
    /span\.terminal\(\{ outcome: "succeeded"[\s\S]{0,200}authorityHash: hashCanonical\(current\)/u);
  assert.doesNotMatch(runtimeSource, /emitState|stateKey:|currentStates|reconciledFromAuthority/u);
  assert.doesNotMatch(executorSource, /runTurn|ProductionGptExecutor|GPT_TURN_FLOW/u);
  assert.match(executorSource, /gpt: gptExecution\.tools/u);
};

export const exerciseProductionRuntimeSourceBoundaries = async (): Promise<void> => {
  await exerciseAcknowledgedFailureRegrant();
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
