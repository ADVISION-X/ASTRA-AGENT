import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transpileModule, ModuleKind } from "typescript";
import type Database from "better-sqlite3";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { heartbeatWhileRunning, ProductionRuntimeBoundaryError } from "../../src/lib/local-runtime/production/runtime-execution-heartbeat.js";
import { buildTerminalProductionIntent, deliverTerminalProductionIntent } from "../../src/lib/local-runtime/production/cloud-terminal-intent.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { task, claimTask, resultFor, shutdownRuntimeFixture, deviceStatusWithoutAdmission,
  deviceStatusWithAdmission, admissionReceiptFor } from "./agent-production-runtime-fixtures.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { reconcileBusinessAdmission } from "../../src/lib/local-runtime/production/runtime-business-admission.js";
import { reconcileCompletedBrowserTargets, workerLoop } from "../../src/lib/local-runtime/production/runtime-loops.js";
import { executionFailure, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { readProductionDeviceJobStatus } from "../../src/lib/local-runtime/production/cloud-reconciliation-client.js";
import { serializeTerminalFailure, serializeTerminalFailureTransport } from
  "../../src/lib/local-runtime/production/terminal-failure.js";

const settleControlReceipt = async (input: Readonly<{
  timers: Map<number, () => void>; order: string[]; jobId: string;
  start: () => void; reply: (value: unknown) => void; intent: "cancel_requested" | "pause_requested";
}>): Promise<void> => {
  for (let turn = 0; turn < 30; turn++) await Promise.resolve();
  assert.equal(input.timers.size, 1);
  const timer = [...input.timers][0]!; input.timers.delete(timer[0]); timer[1]();
  for (let turn = 0; turn < 30; turn++) await Promise.resolve();
  input.start();
  for (let turn = 0; turn < 30; turn++) await Promise.resolve();
  assert.deepEqual(input.order, ["stage"], "real callback is waiting for the in-flight renewal");
  input.reply({ schema_version: "xuanxue-ai-lease-renew-receipt.v6", job_id: input.jobId,
    server_now: "2026-09-03T00:00:00.000Z", lease_expires_at: "2026-09-03T00:05:00.000Z", renew_after_ms: 20_000,
    control_intent: { schema_version: "xuanxue-ai-control-intent.v6", job_id: input.jobId,
      intent: input.intent, control_epoch: 1, reason_code: "user_control" } });
};

const verifyFirstTerminalReadback = (input: Readonly<{
  mode: string; controlled: boolean; order: string[]; timers: Readonly<{ size: number }>;
  controller: AbortController; store: ProductionRuntimeStore; jobId: string;
  result: ReturnType<typeof resultFor>; terminalId: string | undefined;
}>): void => {
  const { mode, store, jobId, result } = input;
  assert.deepEqual(input.order, mode === "stage-failure" ? [] : input.controlled ? ["stage"] : ["stage", "send", "cleanup"]);
  assert.equal(input.timers.size, 0);
  if (input.controlled) {
    assert.equal(input.controller.signal.aborted, true);
    assert.match(String(input.controller.signal.reason), /^CONTROL_INTENT:/u);
    assert.deepEqual(store.readTask(jobId)?.staged_result, result); assert.equal(store.hasUnsentOutbox(jobId), true);
  }
  if (mode === "stage-failure") assert.equal(store.readTask(jobId)?.staged_result, null);
  if (mode === "send-unknown") {
    assert.deepEqual(store.readTask(jobId)?.staged_result, result);
    assert.equal(store.readOutboxAuthority(input.terminalId!)?.lastError, "CLOUD_TRANSPORT_UNAVAILABLE");
  }
  if (mode === "completed-race") {
    assert.equal(store.readTask(jobId)?.current_reason, null);
    assert.equal(store.readOutboxAuthority(input.terminalId!)?.lastError, "BROWSER_CLEANUP_PENDING");
  }
};

/** Execute the original claim-operation source against native SQLite/Outbox with controlled transport. */
export const exerciseFirstTerminalBeforeProducerCleanup = async (store: ProductionRuntimeStore): Promise<void> => {
  const source = readFileSync(new URL("../../src/lib/local-runtime/production/runtime-claim-operations.ts", import.meta.url), "utf8");
  const code = transpileModule(source.slice(source.indexOf("const sendStagedTerminal =")), {
    compilerOptions: { module: ModuleKind.CommonJS },
  }).outputText;
  for (const mode of ["completed-race", "send-unknown", "stage-failure", "foreign-attempt", "foreign-result", "cancel", "pause"] as const) {
    const job = task({ jobId: `job:first-send-${mode}`, productId: "payment_screenshot_observation", actionId: "observe" });
    const claim = claimTask(job), result = resultFor(job), order: string[] = [];
    const envelopeHash = hashCanonical("fixture:envelope");
    const receipts = [{ role: "result_payload", receipt_hash: result.result_object_receipt.receipt_hash },
      { role: "result_envelope", receipt_hash: envelopeHash }];
    store.acceptTask(job, claim.grant.attempt_id);
    const controller = new AbortController(), timers = new Map<number, () => void>();
    const priorTimer = globalThis.setTimeout, priorClear = globalThis.clearTimeout;
    let timerId = 0, start!: () => void, renewReply!: (value: unknown) => void;
    globalThis.setTimeout = ((run: () => void) => { const key = ++timerId; timers.set(key, run); return key; }) as never;
    globalThis.clearTimeout = ((key: number) => { timers.delete(key); }) as never;
    const controlled = mode === "cancel" || mode === "pause";
    try {
      let terminalId: string | undefined;
      const state = { lastErrorCode: null, lastErrorReason: null,
        store: new Proxy(store, { get: (target, key) => key === "stageResultAndEnqueueTerminal" ?
          (input: Parameters<typeof store.stageResultAndEnqueueTerminal>[0]) => {
            if (mode === "stage-failure") throw executionFailure("failed", "PRODUCTION_STAGED_RESULT_TERMINAL_CONFLICT");
            store.stageResultAndEnqueueTerminal({ ...input, websiteStagedArtifactReceipts: receipts });
            terminalId = input.terminal.idempotency_key; order.push("stage");
          } : typeof Reflect.get(target, key) === "function" ? Reflect.get(target, key).bind(target) : Reflect.get(target, key) }),
        runtimeLogger: { startSpan: () => ({ ok: true, event: { spanId: "span:fixture",
          terminal: () => ({ ok: true, event: { eventId: "event:renew" } }) } }) },
        session: { workerSessionId: "session:fixture", workerSessionEpoch: 1, request: async (pathname: string) => {
          if (pathname.endsWith("/renew")) return new Promise(resolve => { renewReply = resolve; });
          order.push("send"); assert.equal(order.includes("cleanup"), false);
          assert.deepEqual(store.readTask(job.job_id)?.staged_result, result);
          assert.equal(store.readOutboxAuthority(terminalId!)?.kind, "terminal");
          if (mode === "send-unknown") throw executionFailure("failed", "CLOUD_TRANSPORT_UNAVAILABLE");
          store.completeTask(job.job_id, result);
          return { schema_version: "xuanxue-ai-terminal-receipt.v6", job_id: job.job_id, terminal_status: "completed",
            payload_hash: hashCanonical(result), failure: null, first_terminal: true, device_id: "device:1", device_epoch: 1,
            worker_session_id: "session:fixture", worker_session_epoch: 1, runtime_attestation_receipt_hash: envelopeHash };
        } },
        executor: { execute: async (_task: unknown, _materials: unknown, _budget: unknown, _parent: unknown,
          complete: (output: unknown) => Promise<unknown>) => {
          if (controlled) await new Promise<void>(resolve => { start = resolve; });
          await complete({ payload: {}, evidence_refs: ["evidence:original"] }); order.push("cleanup");
          const db = Reflect.get(store, "database") as Database.Database;
          if (mode === "foreign-attempt") db.prepare("update production_tasks set current_attempt_id='attempt:foreign' where job_id=?").run(job.job_id);
          if (mode === "foreign-result") db.prepare("update production_tasks set result_json=? where job_id=?").run(
            JSON.stringify({ ...result, execution_receipt_hash: envelopeHash }), job.job_id);
          if (mode !== "send-unknown") throw executionFailure("failed", "LATE_PRODUCER_CLEANUP_FAILED");
          return { record: store.readTask(job.job_id), result, providerEffectReadbackProof: null };
        } },
      };
      const api: Record<string, (input: unknown) => Promise<{ execution: { result: unknown } }>> = {};
      runInNewContext(code, { exports: api, heartbeatWhileRunning,
        uploadProductionResult: async () => ({ envelope: result, artifact_receipts: receipts }),
        buildTerminalProductionIntent, deliverTerminalProductionIntent, hashCanonical, executionFailure, ProductionRuntimeBoundaryError,
        requireRuntimeLogWrite: (write: { event: unknown }) => write.event, runRuntimeSpan: ({ action }: { action: () => unknown }) => action(),
        jobIdentity: () => ({}), failureCode: (error: { code?: string }, fallback: string) => error.code ?? fallback,
        safeReason: (error: Error) => error.message, isResultTransportBoundary: () => false,
      });
      const execution = api.executeAndUpload!({ state, job: claim, task: job, budget: {}, materials: [], abort: controller, jobSpan: { spanId: "span:fixture" } });
      if (controlled) await settleControlReceipt({ timers, order, jobId: job.job_id,
        start: () => { assert.ok(start); start(); }, reply: value => { assert.ok(renewReply); renewReply(value); },
        intent: mode === "cancel" ? "cancel_requested" : "pause_requested" });
      if (mode === "stage-failure" || mode.startsWith("foreign-")) await assert.rejects(execution);
      else assert.deepEqual((await execution).execution.result, result);
      verifyFirstTerminalReadback({ mode, controlled, order, timers, controller, store,
        jobId: job.job_id, result, terminalId });
    } finally { globalThis.setTimeout = priorTimer; globalThis.clearTimeout = priorClear; }
  }
};

/** Verifies the public failure transport and the Runtime/Website authority boundary. */
export const verifyRecoveryFailureTransport = async (
  providerEffectHash: `sha256:${string}`,
): Promise<void> => {
  assert.deepEqual(serializeTerminalFailureTransport(
    executionFailure("failed", "PRODUCT_EXECUTION_FAILED", { metadata: {
      mutationOutcome: "confirmed",
      browserEffect: {
        effectScope: "provider_effect", childCapabilityId: "submit_exact_gpt_turn_once",
        browserOutcome: "CONFIRMED", providerEffectIdentityHash: providerEffectHash,
      },
    }}),
  ), { ...serializeTerminalFailure(executionFailure("failed", "PRODUCT_EXECUTION_FAILED")),
    mutation_outcome: "confirmed", effect_scope: "provider_effect",
    child_capability_id: "submit_exact_gpt_turn_once", browser_outcome: "CONFIRMED",
    provider_effect_identity_hash: providerEffectHash, settled_result_payload_hash: null });
  const early = serializeTerminalFailureTransport(executionFailure("failed", "BROWSER_JOB_TARGET_ACQUISITION_TIMEOUT", {
    cause: new Error("BROWSER_JOB_TARGET_ACQUISITION_TIMEOUT"),
  }));
  assert.deepEqual([early.child_capability_id, early.effect_scope, early.browser_outcome, early.evidence_ref, early.evidence_hash],
    [null, null, null, null, null], "V6 Browser fact fields remain empty when no Browser effect exists");
  assert.deepEqual(early.cause, { name: "Error", code: null });
  const remoteFailureCore = serializeTerminalFailureTransport(
    executionFailure("failed", "REMOTE_FAILURE_FACT"),
  );
  const remoteFailure = { ...remoteFailureCore, from_status: "failed", to_status: "failed",
    attempt_id: "attempt:remote-failure", lease_version: 3 };
  const deviceStatus = (attemptFailure: unknown) => ({
    schema_version: "xuanxue-ai-device-job-status.v6",
    job_id: "job:remote-failure",
    status: "failed",
    current_reason: null,
    attempt_failure: attemptFailure,
    control_intent: { schema_version: "xuanxue-ai-control-intent.v6",
      job_id: "job:remote-failure", control_epoch: 0, intent: "none", reason_code: null },
    next_action_code: "ACTIVE_ATTEMPT",
    terminal_status: null,
    terminal_payload_hash: null,
    business_admission_receipt: null,
    business_consumer_error: null,
    accepted_attempt_count: 1,
    write_receipts: [],
    staged_result: null,
    staged_artifact_receipts: [],
  });
  const parsedRemote = await readProductionDeviceJobStatus({
    request: async () => deviceStatus(remoteFailure),
  } as never, "job:remote-failure");
  assert.deepEqual(parsedRemote.attempt_failure, remoteFailure);
  await assert.rejects(readProductionDeviceJobStatus({
    request: async () => deviceStatus(serializeTerminalFailure(
      executionFailure("failed", "LEGACY_REMOTE_FAILURE"),
    )),
  } as never, "job:remote-failure"),
  (error: unknown) => typedExecutionFailure(error)?.code === "V6_DEVICE_ATTEMPT_FAILURE_INVALID");
  const runtimeClaimPaths = ["runtime-claim.ts", "runtime-claim-recovery.ts",
    "runtime-claim-source-readback-failure.ts", "runtime-claim-preproduct.ts"];
  const runtimeClaims = await Promise.all(runtimeClaimPaths.map(async (path) => readFile(new URL(
    `../../src/lib/local-runtime/production/${path}`, import.meta.url,
  ), "utf8")));
  for (const runtimeClaim of runtimeClaims) {
    assert.doesNotMatch(runtimeClaim, /browser-mutation-authority|browser-mutations\.sqlite/u,
      "Runtime must transport the public typed effect fact without reading Browser private storage");
  }
  const runtimeClaim = runtimeClaims[0]!;
  assert.match(runtimeClaim, /serializeTerminalFailureTransport/u);
  assert.doesNotMatch(runtimeClaim, /provider_effect_identity_hash: _effectTransportOnly/u);
  assert.match(runtimeClaim, /buildProductionLeaseRelease/u);
  const runtimeLoops = await readFile(new URL(
    "../../src/lib/local-runtime/production/runtime-loops.ts", import.meta.url,
  ), "utf8");
  assert.match(runtimeLoops,
    /const browser = state\.browserAuthority\.readProductionRuntimeState\(\);[\s\S]*?browser\.browserAuthorityState === "present"[\s\S]*?if \(!eligible\) return 1_000;[\s\S]*?requestClaimBatch/u,
    "the worker must fail closed before claiming when Browser Authority is absent");
};

/** Stage the original terminal intents; only a real controlled transport response confirms a write. */
const stageTerminalRedeliveryFixture = async (store: ProductionRuntimeStore, mode: "single" | "unconfirmed" | "regrant") => {
  const job = task({ jobId: `job:settled-${mode}`, productId: "payment_screenshot_observation", actionId: "observe" });
  const claim = claimTask(job), result = resultFor(job);
  const receipts = [result.result_object_receipt.receipt_hash, result.execution_receipt_hash];
  const response = { schema_version: "xuanxue-ai-terminal-receipt.v6", job_id: job.job_id,
    terminal_status: "completed", payload_hash: hashCanonical(result), failure: null, first_terminal: true,
    device_id: claim.grant.device_id, device_epoch: claim.grant.device_epoch,
    worker_session_id: claim.grant.worker_session_id, worker_session_epoch: claim.grant.worker_session_epoch,
    runtime_attestation_receipt_hash: result.execution_receipt_hash };
  const session = { workerSessionId: claim.grant.worker_session_id,
    workerSessionEpoch: claim.grant.worker_session_epoch, request: async () => response };
  const input = { status: "completed" as const, payload_hash: hashCanonical(result),
    result_receipt_hashes: receipts, terminal_source_first_fact_raw: null };
  const writeReceipts = receipts.map((receipt, index) => ({ request_id: `artifact:${job.job_id}:${index}`,
    write_kind: "artifact" as const, payload_hash: hashCanonical({}), response_json: { receipt_hash: receipt } }));
  const original = buildTerminalProductionIntent(session as never, claim, input);
  store.acceptTask(job, claim.grant.attempt_id);
  for (const [index, receipt] of receipts.entries()) {
    const key = `artifact:${job.job_id}:${index}`;
    store.enqueue({ idempotency_key: key, kind: "artifact", method: "PUT",
      headers: { "x-ai-content-sha256": hashCanonical({}) }, body: "{}",
      path: `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/artifacts/result/${index}` });
    await store.deliverOutbox(key, async () => ({ receipt_hash: receipt }));
  }
  store.stageResultAndEnqueueTerminal({ jobId: job.job_id, attemptId: claim.grant.attempt_id,
    result, terminal: original.write, websiteStagedArtifactReceipts: [
      { role: "result_payload", receipt_hash: receipts[0]! }, { role: "result_envelope", receipt_hash: receipts[1]! },
    ] });
  assert.equal(store.isLedgerConsistent(new Set()), true);
  if (mode === "single") await deliverTerminalProductionIntent(session as never, store, original);
  if (mode === "regrant") {
    const grant = { ...claim.grant, same_accepted_attempt: true, lease_version: 2,
      execution_fence: { ...claim.grant.execution_fence, lease_version: 2 } };
    const second = buildTerminalProductionIntent(session as never, { ...claim, lease_version: 2, grant }, input);
    assert.notEqual(second.requestId, original.requestId);
    store.acceptTask(job, grant.attempt_id); store.enqueue(second.write);
    await deliverTerminalProductionIntent(session as never, store, second);
    assert.equal(store.readOutboxAuthority(second.requestId)?.state, "delivered");
    assert.deepEqual(store.readOutboxResponse(second.requestId), response);
  }
  const admitted = deviceStatusWithAdmission(admissionReceiptFor(job.job_id,
    result.result_payload_hash), job.job_id, hashCanonical(result), result) as { request: () => Promise<Record<string, unknown>> };
  const state = { store, session: { request: async () => ({ ...await admitted.request(), write_receipts: writeReceipts }) },
    lastErrorCode: null };
  if (mode === "unconfirmed") store.completeTask(job.job_id, result); // Historical completed row without its terminal ACK.
  else assert.equal(await reconcileBusinessAdmission(state as never, store.readTask(job.job_id)!), "completed");
  assert.equal(state.lastErrorCode, null, "admission reconciles the actual artifact write receipts");
  assert.equal(store.isLedgerConsistent(new Set()), true, "Pending cleanup is already legal");
  return { job, result, original };
};

type SettledTerminalFixture = Awaited<ReturnType<typeof stageTerminalRedeliveryFixture>>;

/** Reopening must read the same authorities without normalizing unconfirmed terminal history. */
const verifySettledLedgerReopen = (store: ProductionRuntimeStore, fixture: SettledTerminalFixture) => {
  const directory = Reflect.get(store, "dataDir") as string;
  const db = Reflect.get(store, "database") as Database.Database;
  const before = db.prepare("select * from production_outbox order by idempotency_key").all();
  const tasks = store.taskAuthorities();
  const schema = db.prepare("select type,name,sql from sqlite_master order by type,name").all();
  store.close();
  const reopened = new ProductionRuntimeStore(directory);
  try {
    const reopenedDb = Reflect.get(reopened, "database") as Database.Database;
    assert.equal(reopened.isLedgerConsistent(new Set()), true);
    assert.deepEqual(reopened.taskAuthorities(), tasks);
    assert.deepEqual(reopenedDb.prepare("select * from production_outbox order by idempotency_key").all(), before);
    assert.deepEqual(reopenedDb.prepare("select type,name,sql from sqlite_master order by type,name").all(), schema);
    assert.deepEqual(reopened.readTask(fixture.job.job_id)?.result, fixture.result);
    return reopened;
  } catch (error) { reopened.close(); throw error; }
};

/** The original worker must admit a different Website grant after the settled result. */
const verifyClaimAfterSettledTerminal = async (store: ProductionRuntimeStore, fixture: SettledTerminalFixture): Promise<void> => {
  const directory = Reflect.get(store, "dataDir") as string;
  const sibling = task({ jobId: "job:settled-sibling", productId: "payment_screenshot_observation", actionId: "observe",
    extra: { parameters: { observation_schema_version: "payment-screenshot-observation-v1" } },
    materialRefs: ["payment_screenshot", "result_contract"].map((role, ordinal) => ({
      material_id: `material:${role}`, ordinal, role, display_name: ordinal === 0 ? "payment.png" : "contract.json",
      object_ref: `object:${role}`, sha256: fixture.result.result_payload_hash, bytes: 2,
      media_type: ordinal === 0 ? "image/png" : "application/json", storage_class: "private_owner_scoped",
      owner_scope_hash: fixture.result.execution_receipt_hash,
      trust_class: ordinal === 0 ? "transport_evidence" : "instruction", may_issue_instruction: ordinal === 1,
    })) });
  const grant = claimTask(sibling), received: string[] = [], executed: string[] = [];
  const logger = createRuntimeLogger({ producer: "settled-ledger", owner: "production-runtime",
    component: "production-runtime", terminalEnabled: false, fileSink: { directoryPath: path.join(directory, "logs") } });
  const session = { workerSessionId: grant.grant.worker_session_id, workerSessionEpoch: grant.grant.worker_session_epoch,
    controlContractVersion: grant.grant.control_contract_version,
    device: { server_base_url: "http://127.0.0.1:4322" },
    authorizationHeaders: async () => {
      assert.equal(store.readTask(sibling.job_id)?.current_attempt_id, grant.grant.attempt_id);
      throw executionFailure("failed", "PRODUCTION_RUNTIME_STOPPED");
    },
    ensureFreshAttestation: async () => ({ claim_eligible: true, issued_at: grant.grant.server_now, reason_codes: [] }),
    requestClaim: async (requestId: string) => {
      received.push(requestId);
      return { schema_version: "xuanxue-ai-claim-batch-receipt.v6", claim_batch_id: grant.grant.claim_batch_id,
        request_id: requestId, request_payload_hash: hashCanonical({ requestId }), outcome: "LEASE_GRANTED", jobs: [grant],
        server_now: grant.grant.server_now, next_claim_after_ms: 1_000, queue_epoch: 1, reason_codes: [] };
    },
    request: async (pathname: string) => {
      assert.equal(pathname, `/internal/ai-production/v6/jobs/${encodeURIComponent(sibling.job_id)}/device-status`);
      return deviceStatusWithoutAdmission(sibling.job_id).request();
    } };
  const state = shutdownRuntimeFixture({ store, dataDir: directory, runtimeLogger: logger, session: session as never });
  state.executor.execute = async (accepted) => {
    executed.push(accepted.job_id);
    throw new ProductionRuntimeBoundaryError(executionFailure("failed", "PRODUCTION_RUNTIME_STOPPED"));
  };
  await workerLoop(state, () => {
    void Promise.all([...state.active.values()]).then(() => state.abort.abort());
  });
  await Promise.all([...state.active.values()]);
  const events = (await readFile(logger.currentSegmentPath()!, "utf8")).trim().split("\n").map(row => JSON.parse(row));
  assert.equal(received.length, 1, "real worker reaches the original claim request");
  assert.equal(state.ledgerReconciled, true);
  assert.ok(store.readTask(sibling.job_id), JSON.stringify(events.filter(event => event.failure)));
  assert.deepEqual(store.readTask(sibling.job_id)?.task, sibling);
  assert.equal(store.readTask(sibling.job_id)?.current_attempt_id, grant.grant.attempt_id);
  assert.deepEqual(executed, [], "the test stops transport after durable accept; no job enters Provider");
  assert.deepEqual(store.readTask(fixture.job.job_id)?.result, fixture.result);
  assert.ok(events.some(event => event.operation === "job.durable-accept" && event.outcome === "succeeded"));
};

/** Native SQLite covers cleanup, missing ACK, dual lease, repeat completion, reopen and actual worker claim. */
export const exerciseSettledTerminalLedgerClosure = async (parent: ProductionRuntimeStore): Promise<void> => {
  for (const mode of ["single", "unconfirmed", "regrant"] as const) {
    const directory = path.join(Reflect.get(parent, "dataDir") as string, `settled-ledger-${mode}`);
    await mkdir(directory);
    let store = new ProductionRuntimeStore(directory);
    try {
      const fixture = await stageTerminalRedeliveryFixture(store, mode);
      const released: string[] = [];
      const state = { store, abort: new AbortController(), browserAuthority: {
        releaseJobBoundTarget: async (jobId: string) => { released.push(jobId); } } };
      await reconcileCompletedBrowserTargets(state as never);
      assert.deepEqual(released, [fixture.job.job_id]);
      assert.deepEqual(store.pendingBrowserCleanupJobIds(), []);
      assert.equal(store.readOutboxAuthority(fixture.original.requestId)?.lastError, "BROWSER_CLEANUP_SETTLED");
      assert.equal(store.isLedgerConsistent(new Set()), true, "Settled cleanup cannot invalidate a completed ledger");
      const db = Reflect.get(store, "database") as Database.Database;
      const original = db.prepare("select * from production_outbox where idempotency_key=?").get(fixture.original.requestId);
      if (mode !== "single") {
        const row = original as { sent_at: string | null; response_json: string | null; response_hash: string | null };
        assert.deepEqual([row.sent_at, row.response_json, row.response_hash], [null, null, null]);
      }
      store.completeTask(fixture.job.job_id, fixture.result);
      await reconcileCompletedBrowserTargets(state as never);
      assert.deepEqual(released, [fixture.job.job_id], "repeat completion cannot schedule a second cleanup");
      assert.deepEqual(db.prepare("select * from production_outbox where idempotency_key=?").get(fixture.original.requestId), original);
      const corrupt = { idempotency_key: `artifact:settled-${mode}`, kind: "artifact" as const,
        path: `/internal/ai-production/v6/jobs/${encodeURIComponent(fixture.job.job_id)}/artifacts/result`,
        method: "PUT" as const, headers: {}, body: "unconfirmed" };
      store.enqueue(corrupt);
      for (const marker of [null, "UNKNOWN_UNCLOSED", "BROWSER_CLEANUP_SETTLED"]) {
        db.prepare("update production_outbox set last_error=? where idempotency_key=?").run(marker, corrupt.idempotency_key);
        assert.equal(store.isLedgerConsistent(new Set()), false, "unconfirmed artifact must not borrow a terminal cleanup marker");
      }
      db.prepare("delete from production_outbox where idempotency_key=?").run(corrupt.idempotency_key);
      assert.equal(store.isLedgerConsistent(new Set()), true);
      store = verifySettledLedgerReopen(store, fixture);
      if (mode === "regrant") await verifyClaimAfterSettledTerminal(store, fixture);
    } finally { if ((Reflect.get(store, "database") as Database.Database).open) store.close(); }
  }
};
