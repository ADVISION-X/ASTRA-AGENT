import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Project } from "ts-morph";

import {
  inspectAgentProductionRuntime,
} from "../audit/domains/agent-production-runtime/inspector.js";
import { runtimeManifestOwnershipDrift } from
  "../audit/domains/agent-production-runtime/contract-inspection.js";
import { workerLoopStopViolations } from
  "../audit/domains/agent-production-runtime/worker-loop-inspection.js";
import { workerLoop } from "../../src/lib/local-runtime/production/runtime-loops.js";
import type { RuntimeState } from "../../src/lib/local-runtime/production/runtime-state.js";

const readRuntimeSource = (relativePath: string) => readFile(
  new URL(`../../src/lib/local-runtime/production/${relativePath}`, import.meta.url), "utf8",
);

const WORKER_LOOP_DELAY_STATEMENT = "delay = Math.min(30_000, Math.max(1_000, delay * 2));";
const WORKER_LOOP_WAIT_STATEMENT = "await wait(delay, state.abort.signal);";
const WORKER_LOOP_ITERATION_STATEMENT = "delay = await workerIteration(state);";

const inspectRuntimeSources = (project: Project, queryRef: string) => {
  const findings: Parameters<typeof inspectAgentProductionRuntime>[1] = [];
  inspectAgentProductionRuntime({
    project,
    sealedRoot: path.resolve("."),
    selectedLawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V74",
    targetSet: { queryRef, count: 1 },
    targetPaths: [],
    lawRequirements: [],
    planEntry: {
      capabilityDomain: "agent-production-runtime",
      manifestPath: "scripts/audit/domains/agent-production-runtime/manifest.json",
      ownerInspectorPath: "scripts/audit/domains/agent-production-runtime/inspector.ts",
      executionGroup: "domain",
      lawIds: ["LAW-AGENT-PRODUCTION-RUNTIME-001-V74"],
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
    (record) => record.lawId === "LAW-AGENT-PRODUCTION-RUNTIME-001-V74",
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
