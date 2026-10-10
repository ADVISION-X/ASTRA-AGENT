import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { transpileModule, ModuleKind } from "typescript";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProductionRuntimeStore as RuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { executeClaim, reconcilePendingAttemptFailures } from
  "../../src/lib/local-runtime/production/runtime-claim.js";
import { executionFailure, failureCode, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { createRuntimeLogger, requireRuntimeLogWrite, runtimeLogCauseEventId } from "../../src/lib/runtime-logs/index.js";
import { terminalSpanFailure } from "../../src/lib/local-runtime/production/runtime-logging.js";
import { readProductionDeviceJobStatus } from "../../src/lib/local-runtime/production/cloud-reconciliation-client.js";
import { reconcileBusinessAdmission, websiteJobAbsent, purgeDeletedJob } from "../../src/lib/local-runtime/production/runtime-business-admission.js";
import { ProviderRateLimitControl } from "../../src/lib/local-runtime/production/provider-rate-limit-control.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { runtimeTransportFailure, typedRuntimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import { classifyAttemptFailure,
  type SerializedTerminalFailure } from
  "../../src/lib/local-runtime/production/terminal-failure.js";
import { HASH_A, claimTask, failureStatus, task, attemptFailureFirstFact, resultFor, stageResultForAcceptance, admissionReceiptFor, deviceStatusWithAdmission } from
  "./agent-production-runtime-fixtures.js";

const SCENARIOS = ["success", "response_unknown", "success_missing_receipt",
  "response_unknown_uncommitted", "duplicate_receipt", "code_only_mismatch", "code_only_exact",
  "receipt_conflicting_fact", "conflict_409"] as const;
type Scenario = (typeof SCENARIOS)[number];

const originalFailureFor = (scenario: Scenario, job: ReturnType<typeof claimTask>) =>
  scenario === "conflict_409" || scenario === "receipt_conflicting_fact" ? {
    code: "WEBSITE_ORIGINAL_FAILURE", mutation_outcome: "no", effect_scope: null,
    child_capability_id: null, browser_outcome: null, evidence_ref: null,
    evidence_hash: null, child_proof_ref: null, child_proof_hash: null,
    stopped_empty_proof: null, cause: null, provider_effect_identity_hash: null,
    settled_result_payload_hash: null, from_status: "failed", to_status: "failed",
    attempt_id: job.grant.attempt_id, lease_version: job.grant.lease_version,
  } as const : null;

const readbackSessionFor = (
  scenario: Scenario, job: ReturnType<typeof claimTask>, executionCode: string, store: RuntimeStore,
) => {
  let postCount = 0;
  let getCount = 0;
  let committedRequest: Readonly<Record<string, unknown>> | null = null;
  const originalFailure = originalFailureFor(scenario, job);
  const session = {
    workerSessionId: "worker:failure-readback",
    workerSessionEpoch: 1,
    device: { server_base_url: "http://127.0.0.1:4322" },
    request: async (path: string, options?: Readonly<{ method?: string; body?: string }>) => {
      if (path.endsWith("/lease-release")) {
        postCount += 1;
        const request = JSON.parse(options?.body ?? "null") as Readonly<Record<string, unknown>>;
        assert.ok(store.readTask(job.job_id)?.attempt_failure,
          "the complete first fact must be durably readable before failure release POST");
        if (scenario !== "response_unknown_uncommitted") committedRequest = request;
        if (scenario === "response_unknown" || scenario === "response_unknown_uncommitted") {
          throw runtimeTransportFailure("CLOUD_TRANSPORT_UNAVAILABLE", 503);
        }
        if (scenario === "conflict_409") {
          throw runtimeTransportFailure("AI_PRODUCTION_ATTEMPT_FAILURE_IDEMPOTENCY_CONFLICT", 409);
        }
        return { ok: true };
      }
      if (!path.endsWith("/device-status")) throw new Error("UNEXPECTED_RUNTIME_REQUEST");
      getCount += 1;
      if (!committedRequest) return failureStatus(job.job_id, null, []);
      if (scenario === "conflict_409") return failureStatus(job.job_id, originalFailure, []);
      if (scenario === "success_missing_receipt") {
        return failureStatus(job.job_id, {
          ...(committedRequest.attempt_failure as Readonly<Record<string, unknown>>),
          from_status: "failed", to_status: "failed",
          attempt_id: job.grant.attempt_id, lease_version: job.grant.lease_version,
        }, []);
      }
      const response = {
        schema_version: "xuanxue-ai-lease-release-receipt.v6",
        job_id: job.job_id,
        task_status: "failed",
        lease_disposition: "released",
        reason_code: executionCode,
        payload_hash: committedRequest.payload_hash,
        terminal_payload_hash: null,
        attempt_failure: committedRequest.attempt_failure,
      };
      const receipt = {
        request_id: committedRequest.request_id,
        write_kind: "lease_release",
        payload_hash: hashCanonical(committedRequest),
        response_json: response,
      };
      return failureStatus(job.job_id,
        scenario === "receipt_conflicting_fact" ? originalFailure : null,
        scenario === "duplicate_receipt"
        ? [receipt, { ...receipt, payload_hash: HASH_A }] : [receipt]);
    },
  };
  return { session, counts: () => ({ postCount, getCount }) };
};

const assertReadbackDisposition = (input: Readonly<{
  scenario: Scenario; store: RuntimeStore; jobId: string; executionCode: string;
  counts: () => Readonly<{ postCount: number; getCount: number }>;
  lastErrorCode: string | null;
}>): void => {
  const { scenario, store, jobId, executionCode, counts, lastErrorCode } = input;
  assert.equal(counts().postCount, 1, `${scenario} must issue exactly one failure release POST`);
  assert.equal(counts().getCount, 2, `${scenario} must read Website before execution and after release`);
  assert.equal(store.readTask(jobId)?.attempt_failure?.failure_core.code,
    executionCode, `${scenario} must preserve the local immutable first fact`);
  if (scenario === "code_only_mismatch") {
    assert.equal(counts().postCount, 1,
      "a mismatch code without the complete Browser fact must use the ordinary failure path");
  }
  if (scenario === "conflict_409" || scenario === "receipt_conflicting_fact") {
    assert.equal(lastErrorCode,
      "PRODUCTION_ATTEMPT_FAILURE_AUTHORITY_CONFLICT",
      "a different Website first fact must be recorded as an authority contradiction");
    assert.match(store.readTask(jobId)?.current_reason ?? "",
      /^PRODUCTION_ATTEMPT_FAILURE_AUTHORITY_CONFLICT\|attempt-failure-authority-conflict\|/u,
      "the local authority must retain a durable local/remote conflict report");
  } else if (scenario === "success_missing_receipt"
    || scenario === "response_unknown_uncommitted") {
    assert.equal(lastErrorCode,
      "PRODUCTION_ATTEMPT_FAILURE_READBACK_MISMATCH",
      `${scenario} must fail closed without the exact request receipt`);
    assert.match(store.readTask(jobId)?.current_reason ?? "",
      /^PRODUCTION_ATTEMPT_FAILURE_READBACK_MISMATCH/u,
      `${scenario} must durably retain the missing-receipt diagnosis`);
  } else if (scenario === "duplicate_receipt") {
    assert.equal(lastErrorCode,
      "PRODUCTION_ATTEMPT_FAILURE_RECEIPT_CONFLICT",
      "duplicate receipts for one request must fail closed even when one receipt matches");
  } else {
    assert.equal(lastErrorCode, null,
      `${scenario} must close through the exact persisted receipt`);
  }
};

const verifyFailureReadbackIsolation = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), "pending-failure-isolation-"));
  const store = new RuntimeStore(directory);
  try {
    const jobs = ["job:failure-A", "job:failure-B"].map((jobId) => task({
      jobId, productId: "payment_screenshot_observation", actionId: "observe" }));
    for (const job of jobs) {
      store.acceptTask(job, "attempt:1");
      store.recordAttemptFailure(job.job_id, "attempt:1", attemptFailureFirstFact("attempt:1", {
        code: "PRODUCT_EXECUTION_FAILED", mutation_outcome: "no", effect_scope: null,
        child_capability_id: null, browser_outcome: null, evidence_ref: null, evidence_hash: null,
        child_proof_ref: null, child_proof_hash: null, stopped_empty_proof: null, cause: null,
        provider_effect_identity_hash: null, settled_result_payload_hash: null }));
    }
    for (const [error, shouldContinue] of [
      [runtimeTransportFailure("OWN_JOB_REMOTE_FAILED", 503), true],
      [runtimeTransportFailure("SESSION_UNAUTHORIZED", 401), false],
      [runtimeTransportFailure("SESSION_FORBIDDEN", 403), false],
      [new Error("STORE_OR_UNKNOWN_FAILURE"), false],
    ] as const) {
      const reads: string[] = [];
      const state = { store, session: { request: async (url: string) => {
        reads.push(url);
        if (reads.length === 1) throw error;
        return failureStatus(jobs[1]!.job_id, null, []);
      } }, lastErrorCode: null, lastErrorReason: null } as never;
      if (shouldContinue) {
        await reconcilePendingAttemptFailures(state);
        assert.equal(reads.length, 2, "own-job failure must preserve the next job's readback");
        assert.equal(store.readTask(jobs[0]!.job_id)?.current_reason, "OWN_JOB_REMOTE_FAILED");
      } else {
        await assert.rejects(reconcilePendingAttemptFailures(state), (actual: unknown) => actual === error);
        assert.equal(reads.length, 1, "shared authorization and raw errors must reach the shared exit");
      }
    }
  } finally { store.close(); await rm(directory, { recursive: true, force: true }); }
};

const verifySuccessfulFailureReadbackIsolation = async (): Promise<void> => {
  for (const action of ["WAIT_NEW_ATTEMPT", "CONSUME_CURRENT_RESULT"] as const) {
    const root = await mkdtemp(join(tmpdir(), "failure-disposition-")), store = new RuntimeStore(root);
    try {
      const jobs = ["A", "B"].map(id => task({ jobId: `job:disposition-${id}`, productId: "payment_screenshot_observation", actionId: "observe" }));
      for (const job of jobs) {
        store.acceptTask(job, "attempt:disposition");
        if (job === jobs[0] && action === "CONSUME_CURRENT_RESULT") stageResultForAcceptance(store, job.job_id, "attempt:disposition", resultFor(job));
        store.recordAttemptFailure(job.job_id, "attempt:disposition", attemptFailureFirstFact("attempt:disposition", {
          code: "PRODUCT_EXECUTION_FAILED", mutation_outcome: "no", effect_scope: null,
          child_capability_id: null, browser_outcome: null, evidence_ref: null, evidence_hash: null,
          child_proof_ref: null, child_proof_hash: null, stopped_empty_proof: null, cause: null,
          provider_effect_identity_hash: null, settled_result_payload_hash: null }));
      }
      for (const [error, continues] of [[executionFailure("failed", "BROWSER_TARGET_CLEANUP_FAILED"), true],
        [runtimeTransportFailure("LOCAL_ADMISSION_503", 503), true], [runtimeTransportFailure("AUTH_401", 401), false],
        [new Error("RAW_STORE_FAILED"), false], [executionFailure("failed", "PRODUCTION_STORE_CORRUPTED"), false]] as const) {
        const reads: string[] = []; let aReads = 0;
        const state = { store, abort: new AbortController(), active: new Map(), browserAuthority: {
          readJobPhysicalInputState: () => "zero", releaseJobBoundTarget: async () => { throw error; } },
          session: { request: async (url: string) => {
            const job = decodeURIComponent(url).includes(jobs[0]!.job_id) ? jobs[0]! : jobs[1]!; reads.push(job.job_id);
            if (job === jobs[0] && aReads++ > 0) throw error;
            const failure = store.readTask(job.job_id)!.attempt_failure!;
            return { ...failureStatus(job.job_id, { ...failure.failure_core,
              attempt_id: "attempt:disposition", lease_version: 1, from_status: "failed", to_status: "failed" }, []), next_action_code: action };
          } }, lastErrorCode: null, lastErrorReason: null };
        if (continues) { await reconcilePendingAttemptFailures(state as never); assert.ok(reads.includes(jobs[1]!.job_id)); }
        else { await assert.rejects(reconcilePendingAttemptFailures(state as never), (actual: unknown) => actual === error); assert.equal(reads.includes(jobs[1]!.job_id), false); }
        assert.equal(store.readTask(jobs[0]!.job_id)?.attempt_failure?.failure_core.code, "PRODUCT_EXECUTION_FAILED");
      }
    } finally { store.close(); await rm(root, { recursive: true, force: true }); }
  }
};

const verifyAdmissionLogFailureAndReadbackIsolation = async (): Promise<void> => {
  const source = await readFile(new URL("../../src/lib/local-runtime/production/runtime-loops.ts", import.meta.url), "utf8");
  const admission = source.slice(source.indexOf("const reconcilePendingBusinessAdmissions ="),
    source.indexOf("export const reconcileCompletedBrowserTargets ="));
  const unfinished = source.slice(source.indexOf("const reconcileUnfinishedExecutionsWithoutReceipt ="),
    source.indexOf("const workerIteration ="));
  const worker = source.slice(source.indexOf("const workerIteration ="), source.indexOf("export const workerLoop ="));
  const api: Record<string, (state: unknown) => Promise<unknown>> = {};
  runInNewContext(transpileModule(admission + unfinished + worker +
    "\nexport { reconcilePendingBusinessAdmissions, reconcileUnfinishedExecutionsWithoutReceipt, workerIteration };", {
    compilerOptions: { module: ModuleKind.CommonJS },
  }).outputText, { exports: api, requireRuntimeLogWrite, failureCode, typedExecutionFailure,
    typedRuntimeTransportFailure, runtimeLogCauseEventId, terminalSpanFailure, hashCanonical,
    reconcileBusinessAdmission, readProductionDeviceJobStatus, websiteJobAbsent, purgeDeletedJob,
    safeReason: (error: Error) => error.message,
    reconcileCompletedBrowserTargets: async (state: { cleanups: number }) => { state.cleanups++; } });
  const root = await mkdtemp(join(tmpdir(), "admission-log-isolation-")), store = new RuntimeStore(root);
  try {
    const jobs = ["A", "B", "C"].map(id => task({ jobId: `job:sink-${id}`,
      productId: "payment_screenshot_observation", actionId: "observe" }));
    for (const job of jobs) {
      const result = resultFor(job); store.acceptTask(job, "attempt:sink");
      stageResultForAcceptance(store, job.job_id, "attempt:sink", result);
      store.markOutboxSent(`terminal:acceptance:${job.job_id}:attempt:sink`, {
        schema_version: "xuanxue-ai-terminal-receipt.v6", job_id: job.job_id, terminal_status: "completed",
        payload_hash: hashCanonical(result), failure: null, first_terminal: true, device_id: "device:test", device_epoch: 1,
        worker_session_id: "session:acceptance", worker_session_epoch: 1, runtime_attestation_receipt_hash: HASH_A });
    }
    let reads = 0, spans = 0;
    let firstError: unknown = runtimeTransportFailure("OWN_ADMISSION_REMOTE_FAILED", 503);
    const session = { device: { device_id: "device:sink" }, workerSessionId: "session:sink", workerSessionEpoch: 1,
        workerInstanceId: "worker:sink", sessionOpenRequestId: "open:sink", request: async (url: string, init?: RequestInit) => {
      assert.equal(init?.method, "GET", "bad sink only permits existing result readback");
      const job = jobs.find(entry => decodeURIComponent(url).includes(entry.job_id));
      assert.ok(job); reads += 1;
      if (reads === 1) throw firstError;
      const result = resultFor(job);
      return (deviceStatusWithAdmission(admissionReceiptFor(job.job_id, result.result_payload_hash),
        job.job_id, hashCanonical(result)) as { request: () => Promise<unknown> }).request();
    } };
    const control = new ProviderRateLimitControl(store, session as never);
    const state = { store, active: new Map(), runtimeLogger: { startSpan: () => {
      spans += 1; throw executionFailure("failed", "RUNTIME_LOG_SINK_WRITE_FAILED");
    }, isWritable: () => false }, cleanups: 0, providerRateLimitControl: control, session };
    await control.beginIncident({ jobId: jobs[0]!.job_id,
      attemptId: "attempt:sink", resultRevision: 0, deviceId: "device:sink", leaseVersion: 1,
      fenceHash: HASH_A, capabilityManifestHash: HASH_A, dialogHash: HASH_A, observationHash: HASH_A,
      sessionKey: "session:sink", observedAt: "2030-01-01T00:00:00.000Z" });
    assert.equal(await api.workerIteration!(state), 1_000);
    assert.equal(store.pendingProviderCooldownRequestIds().length, 1);
    assert.equal(reads, 3); assert.equal(spans, 3);
    assert.equal(store.readTask(jobs[0]!.job_id)?.current_reason, "OWN_ADMISSION_REMOTE_FAILED");
    assert.equal(store.readTask(jobs[1]!.job_id)?.status, "completed");
    assert.equal(store.readTask(jobs[2]!.job_id)?.status, "completed");
    assert.equal(store.pendingBrowserCleanupJobIds().includes(jobs[1]!.job_id), true);
    for (const error of [runtimeTransportFailure("SESSION_UNAUTHORIZED", 401),
      runtimeTransportFailure("SESSION_FORBIDDEN", 403), new Error("RAW_STORE_FAILURE")]) {
      reads = 0; firstError = error;
      await assert.rejects(api.reconcilePendingBusinessAdmissions!(state), (actual: unknown) => actual === error);
      assert.equal(reads, 1, "shared authorization and raw failures retain the shared exit");
    }
    reads = 0; firstError = runtimeTransportFailure("OWN_ADMISSION_REMOTE_FAILED", 503);
    const sinkDelay = await api.workerIteration!(state);
    assert.equal(sinkDelay, 1_000); assert.equal(state.cleanups, 2);
    assert.equal(store.readTask(jobs[0]!.job_id)?.status, "failed");
    const unfinishedJobs = ["A", "B"].map(id => task({ jobId: `job:unfinished-${id}`,
      productId: "payment_screenshot_observation", actionId: "observe" }));
    for (const job of unfinishedJobs) store.acceptTask(job, "attempt:unfinished");
    state.session.request = async (url: string) => {
      const job = unfinishedJobs.find(entry => decodeURIComponent(url).includes(entry.job_id));
      assert.ok(job); reads += 1;
      if (reads === 1) throw firstError;
      return failureStatus(job.job_id, null, []);
    };
    reads = 0; firstError = runtimeTransportFailure("OWN_UNFINISHED_REMOTE_FAILED", 503);
    await api.reconcileUnfinishedExecutionsWithoutReceipt!(state);
    assert.equal(reads, 2); assert.equal(store.readTask(unfinishedJobs[0]!.job_id)?.current_reason, "OWN_UNFINISHED_REMOTE_FAILED");
    reads = 0; firstError = runtimeTransportFailure("SESSION_UNAUTHORIZED", 401);
    await assert.rejects(api.reconcileUnfinishedExecutionsWithoutReceipt!(state), (actual: unknown) => actual === firstError);
    assert.equal(reads, 1);
  } finally { store.close(); await rm(root, { recursive: true, force: true }); }
};

export const verifyFailureReleaseReadbackScenarios = async (): Promise<void> => {
  await verifyAdmissionLogFailureAndReadbackIsolation();
  await verifyFailureReadbackIsolation();
  await verifySuccessfulFailureReadbackIsolation();
  for (const scenario of SCENARIOS) {
    const temporary = await mkdtemp(join(tmpdir(), `agent-failure-readback-${scenario}-`));
    let store = new RuntimeStore(temporary);
    try {
      const websiteTask = task({
        jobId: `job:failure-readback:${scenario}`,
        productId: "payment_screenshot_observation",
        actionId: "observe",
      });
      const job = claimTask(websiteTask);
      const activeAbort = new AbortController();
      const executionCode = scenario === "code_only_mismatch"
        ? "BROWSER_GPT_DIALOG_UNRECOGNIZED"
        : scenario === "code_only_exact"
          ? "BROWSER_KNOWN_GPT_RATE_LIMIT" : "PRODUCT_EXECUTION_FAILED";
      const { session, counts } = readbackSessionFor(scenario, job, executionCode, store);
      const runtimeLogger = createRuntimeLogger({
        producer: `agent-failure-readback-${scenario}`,
        owner: "production-runtime", component: "production-runtime", terminalEnabled: false,
        fileSink: { directoryPath: join(temporary, "runtime-logs") },
      });
      const state = {
        abort: new AbortController(),
        active: new Map(),
        activeAbort: new Map([[job.job_id, activeAbort]]),
        store,
        executor: {
          accept: (acceptedTask: typeof websiteTask, attemptId: string) =>
            store.acceptTask(acceptedTask, attemptId),
          acceptAfterFailureReconciled: () => { throw new Error("UNEXPECTED_RECONCILIATION"); },
          execute: async () => {
            throw executionFailure("failed", executionCode,
              scenario === "code_only_mismatch" || scenario === "code_only_exact"
              ? { metadata: { mutationOutcome: "no", evidence: {
                  evidenceRef: "non-authoritative-code-only", evidenceHash: HASH_A,
                } } } : {});
          },
        },
        session,
        providerRateLimitControl: {}, browserAuthority: {}, gpt: {}, evidenceStore: {},
        dataDir: temporary, runtimeLogger, draining: false, lastHeartbeat: null,
        lastErrorCode: null, lastErrorReason: null, stopped: false, ledgerReconciled: true,
      } as never;
      await executeClaim(state, job);
      assertReadbackDisposition({ scenario, store, jobId: job.job_id, executionCode, counts,
        lastErrorCode: (state as { lastErrorCode: string | null }).lastErrorCode });

      store.close();
      store = new RuntimeStore(temporary);
      const restartedState = { ...(state as object), store } as never;
      await reconcilePendingAttemptFailures(restartedState);
      if (scenario === "duplicate_receipt") {
        assert.equal(store.readTask(job.job_id)?.current_reason, "PRODUCTION_ATTEMPT_FAILURE_RECEIPT_CONFLICT");
        assert.equal(store.readTask(job.job_id)?.attempt_failure?.failure_core.code, executionCode,
          "receipt conflict isolates this job and preserves its immutable first fact");
      }
      assert.equal(counts().postCount, 1,
        `${scenario} restart reconciliation must remain GET-only and never replay the POST`);
      assert.equal(counts().getCount, 3, `${scenario} restart reconciliation must perform one exact readback`);
    } finally {
      store.close();
      await rm(temporary, { recursive: true, force: true });
    }
  }
};

export const verifyAttemptFailureClassificationMatrix = (): void => {
  const base: SerializedTerminalFailure = {
    code: "PRODUCT_EXECUTION_FAILED", mutation_outcome: "no", effect_scope: null,
    child_capability_id: null, browser_outcome: null, evidence_ref: null, evidence_hash: null,
    child_proof_ref: null, child_proof_hash: null, stopped_empty_proof: null, cause: null,
    provider_effect_identity_hash: null, settled_result_payload_hash: null,
  };
  const classify = (override: Partial<SerializedTerminalFailure>) =>
    classifyAttemptFailure({ ...base, ...override });
  const browserFact = {
    child_capability_id: "submit_exact_gpt_turn_once",
    evidence_ref: "browser-mutation:classification", evidence_hash: HASH_A,
  };
  const providerFact = { ...browserFact, effect_scope: "provider_effect" as const,
    provider_effect_identity_hash: HASH_A };
  for (const mutation_outcome of ["no", "dispatched", "confirmed"] as const) {
    assert.equal(classify({ ...browserFact, effect_scope: "target_local", browser_outcome: "REJECTED",
      mutation_outcome }), "new_attempt_allowed");
  }
  assert.equal(classify({ ...providerFact, browser_outcome: "REJECTED",
    mutation_outcome: "no" }), "new_attempt_allowed");
  for (const [browser_outcome, mutation_outcome] of [
    ["DISPATCHED", "dispatched"], ["CONFIRMED", "confirmed"],
    ["REJECTED", "dispatched"], ["REJECTED", "confirmed"],
  ] as const) assert.equal(classify({ ...providerFact, browser_outcome,
    mutation_outcome }), "same_attempt_provider_readback");
  for (const [browser_outcome, mutation_outcome] of [
    [null, "dispatched"], ["DISPATCHED", "confirmed"], ["CONFIRMED", "dispatched"],
    ["CONFIRMED", "no"], ["DISPATCHED", "no"],
  ] as const) assert.equal(classify({ ...providerFact, browser_outcome,
    mutation_outcome }), "fail_closed");
  for (const incomplete of [
    { ...providerFact, child_capability_id: null },
    { ...providerFact, evidence_ref: null },
    { ...providerFact, evidence_hash: null },
    { ...providerFact, provider_effect_identity_hash: null },
  ]) assert.equal(classify({ ...incomplete, browser_outcome: "CONFIRMED",
    mutation_outcome: "confirmed" }), "fail_closed");
  assert.equal(classify({ effect_scope: "target_local", browser_outcome: "REJECTED",
    mutation_outcome: "no" }), "fail_closed");
  const confirmedEffect = {
    ...providerFact, browser_outcome: "CONFIRMED" as const, mutation_outcome: "confirmed" as const,
  };
  assert.equal(classify({ ...confirmedEffect, code: "RESULT_SETTLED_UNUSABLE",
    settled_result_payload_hash: HASH_A }), "new_attempt_allowed");
  assert.equal(classify({ ...confirmedEffect, code: "RESULT_SETTLED_UNUSABLE" }), "fail_closed");
  assert.equal(classify({ ...confirmedEffect, code: "GPT_RESPONSE_STOPPED_EMPTY",
    child_capability_id: "submit_exact_gpt_turn_once", child_proof_ref: "child-proof:1",
    child_proof_hash: HASH_A, stopped_empty_proof: {
      first_observed_at: "2026-09-23T00:00:00.000Z",
      terminal_observed_at: "2026-09-23T00:20:00.000Z", continuous_monotonic_ms: 1_200_000,
      observation_count: 2, identity_hash: HASH_A, terminal_observation_revision_hash: HASH_A,
    },
  }), "new_attempt_allowed");
  assert.equal(classify({ ...confirmedEffect, code: "GPT_RESPONSE_STOPPED_EMPTY" }), "fail_closed");
};
