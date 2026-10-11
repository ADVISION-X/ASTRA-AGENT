import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transpileModule, ModuleKind } from "typescript";
import type Database from "better-sqlite3";
import type { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { heartbeatWhileRunning, ProductionRuntimeBoundaryError } from "../../src/lib/local-runtime/production/runtime-execution-heartbeat.js";
import { buildTerminalProductionIntent, deliverTerminalProductionIntent } from "../../src/lib/local-runtime/production/cloud-terminal-intent.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { task, claimTask, resultFor } from "./agent-production-runtime-fixtures.js";
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
