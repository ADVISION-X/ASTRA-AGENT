import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import type { ProductionExecutionLease } from "../../src/lib/local-runtime/production/contracts.js";
import { getEventListeners } from "node:events";
import {
  renewFailureRetryable,
  renewWithinBudget,
  heartbeatWhileRunning,
} from "../../src/lib/local-runtime/production/runtime-execution-heartbeat.js";
import { typedRuntimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import { exerciseMaterialLeaseBoundary } from "./agent-production-runtime-material-lease.acceptance-support.js";
import {
  DeviceCredentialSchema,
  type ClaimedProductionTask,
} from "../../src/lib/local-runtime/production/transport-protocol.js";
import { ProductionWorkerSession } from "../../src/lib/local-runtime/production/worker-session.js";
import {
  HASH_A, HASH_B, claimTask, task, validDeviceCredential,
} from "./agent-production-runtime-fixtures.js";

const successfulJsonResponse = (data: unknown, status = 200): Response => new Response(
  JSON.stringify({ ok: true, data }), { status, headers: { "content-type": "application/json" } },
);
const typedErrorResponse = (status: number, code: string): Response => new Response(
  JSON.stringify({ ok: false, error: { code, message: code, status, request_id: "req:renew-retry" } }),
  { status, headers: { "content-type": "application/json" } },
);
const brokenGatewayResponse = (status: number): Response => new Response(
  "<html>bad gateway</html>", { status, headers: { "content-type": "text/html" } },
);

const job = (): ClaimedProductionTask => claimTask(task({
  jobId: "job:renew-retry", productId: "payment_screenshot_observation", actionId: "observe",
}));

const renewReceipt = (input: Readonly<{ job: ClaimedProductionTask }>) => ({
  schema_version: "xuanxue-ai-lease-renew-receipt.v6", job_id: input.job.job_id,
  server_now: "2026-09-03T00:00:00.000Z", lease_expires_at: "2026-09-03T00:05:00.000Z",
  renew_after_ms: 20_000,
  control_intent: { schema_version: "xuanxue-ai-control-intent.v6", job_id: input.job.job_id,
    intent: "none" as const, control_epoch: 0, reason_code: null },
});

const withFakeClock = async <T>(run: () => Promise<T>): Promise<T> => {
  const originalDateNow = Date.now;
  const originalPerfNow = performance.now;
  const originalSetTimeout = globalThis.setTimeout;
  const base = Date.parse("2026-09-03T00:00:00.000Z");
  let now = 0;
  Date.now = () => base + now;
  performance.now = () => now;
  globalThis.setTimeout = ((handler: (...args: unknown[]) => void, ms?: number) => {
    if ((ms ?? 0) >= 30_000) return originalSetTimeout(handler, ms);
    now += typeof ms === "number" ? ms : 0;
    queueMicrotask(handler);
    return originalSetTimeout(() => undefined, 0);
  }) as typeof setTimeout;
  try {
    return await run();
  } finally {
    Date.now = originalDateNow;
    performance.now = originalPerfNow;
    globalThis.setTimeout = originalSetTimeout;
  }
};

const renewSessionFetch = (
  steps: readonly Response[],
  requestIds: string[],
): typeof globalThis.fetch => {
  let renewCallCount = 0;
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.endsWith("/sessions/open")) return successfulJsonResponse({
      session: { device_id: validDeviceCredential.device_id, worker_session_id: "worker-session:renew-retry",
        worker_session_epoch: 1, control_contract_version: 47, attestation_seq: 0 },
      session_credential: {
        schema_version: "xuanxue-ai-worker-session-credential.v6",
        worker_session_id: "worker-session:renew-retry", worker_session_epoch: 1,
        token: `aisc_v6_${"a".repeat(40)}`, token_generation: 1,
        issued_at: "2026-09-03T00:00:00.000Z", expires_at: "2099-09-03T00:00:00.000Z",
        previous_generation_valid_until: null,
      },
    });
    if (!url.includes("/renew")) throw new Error(`UNEXPECTED_RENEW_RETRY_TEST_URL:${url}`);
    if (typeof init?.body === "string") {
      requestIds.push((JSON.parse(init.body) as { request_id: string }).request_id);
    }
    const step = steps[renewCallCount];
    renewCallCount += 1;
    if (!step) throw new Error("UNEXPECTED_RENEW_RETRY_CALL");
    return step;
  };
};

const openedSession = async (): Promise<ProductionWorkerSession> => {
  const session = new ProductionWorkerSession(
    DeviceCredentialSchema.parse(validDeviceCredential),
    () => ({ agent_attested_in_flight: 0, browser_action_in_flight: 0, browser_authority_state: "present",
      browser_target_state: "absent", browser_lane_state: "idle", drain_state: "open", ledger_reconciled: true }),
    HASH_B, () => true, "worker-instance:renew-retry",
  );
  await session.open();
  return session;
};

const budgetWithLeftMs = (leftMs: number): ProductionExecutionLease => ({
  attempt_id: "attempt:renew-retry", device_id: validDeviceCredential.device_id, lease_version: 1,
  execution_fence_hash: HASH_A, capability_manifest_hash: HASH_B,
  max_provider_turns: 8, result_revision: 0, prior_result_rejection: null,
  delivery_priority_replay_grant: null, provider_turns_used: 0,
  expires_at_monotonic: performance.now() + leftMs, command_ttl_ms: 5_000,
  abort_signal: new AbortController().signal,
});

const exerciseRenewRetry = async (
  steps: readonly Response[],
  leftMs: number,
): Promise<Readonly<{
  outcome: Promise<unknown>; requestIds: string[]; elapsedMs: () => number;
}>> => {
  const originalFetch = globalThis.fetch;
  const requestIds: string[] = [];
  globalThis.fetch = renewSessionFetch(steps, requestIds);
  const session = await openedSession();
  const started = performance.now();
  const controller = new AbortController();
  const outcome = renewWithinBudget({
    session, job: job(), budget: budgetWithLeftMs(leftMs), signal: controller.signal,
  }).finally(() => { globalThis.fetch = originalFetch; });
  return { outcome, requestIds, elapsedMs: () => performance.now() - started };
};

// S4.1: a single 500 must not abort the job; the retry uses a fresh request_id, spaced ~5s.
const exerciseSingleTransientRecovery = async (): Promise<void> => {
  await withFakeClock(async () => {
    const j = job();
    const { outcome, requestIds, elapsedMs } = await exerciseRenewRetry([
      typedErrorResponse(500, "AI_PRODUCTION_UPSTREAM_TRANSIENT"),
      successfulJsonResponse(renewReceipt({ job: j })),
    ], 60_000);
    const receipt = await outcome as Readonly<{ job_id: string }>;
    assert.equal(receipt.job_id, j.job_id);
    assert.equal(requestIds.length, 2);
    assert.notEqual(requestIds[0], requestIds[1], "each renew attempt must carry a fresh request_id");
    assert.equal(elapsedMs(), 5_000, "the retry must wait the extension-owned ~5s interval");
  });
};

// S4.2: a non-JSON 502 must fail as AI_PRODUCTION_HTTP_ENVELOPE_INVALID with httpStatus=502, then retry.
const exerciseNonJsonGatewayFailureRetries = async (): Promise<void> => {
  await withFakeClock(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = renewSessionFetch([brokenGatewayResponse(502)], []);
    try {
      const { renewProductionLease } = await import("../../src/lib/local-runtime/production/cloud-client.js");
      const session = await openedSession();
      const failure = await renewProductionLease(session, job())
        .then(() => null, (error: unknown) => error);
      const transport = typedRuntimeTransportFailure(failure);
      assert.ok(transport, "a non-JSON envelope must surface as a typed transport failure");
      assert.equal(transport!.code, "AI_PRODUCTION_HTTP_ENVELOPE_INVALID");
      assert.equal(transport!.httpStatus, 502);
      assert.equal(renewFailureRetryable(failure), true, "a 502 must be classified retryable");
    } finally {
      globalThis.fetch = originalFetch;
    }
    const j = job();
    const { outcome, requestIds } = await exerciseRenewRetry([
      brokenGatewayResponse(502), successfulJsonResponse(renewReceipt({ job: j })),
    ], 60_000);
    const receipt = await outcome as Readonly<{ job_id: string }>;
    assert.equal(receipt.job_id, j.job_id);
    assert.equal(requestIds.length, 2);
  });
};

// S4.3: a 409 AI_LEASE_FENCE_STALE must abort immediately, with no retry attempt.
const exerciseFenceStaleAbortsImmediately = async (): Promise<void> => {
  await withFakeClock(async () => {
    const { outcome, requestIds } = await exerciseRenewRetry([
      typedErrorResponse(409, "AI_LEASE_FENCE_STALE"),
    ], 60_000);
    await assert.rejects(outcome, /AI_LEASE_FENCE_STALE/u);
    assert.equal(requestIds.length, 1, "a 4xx typed rejection must not be retried");
  });
};

// S4.4: a 2xx response whose receipt does not match the schema must abort immediately.
const exerciseReceiptSchemaInvalidAbortsImmediately = async (): Promise<void> => {
  await withFakeClock(async () => {
    const { outcome, requestIds } = await exerciseRenewRetry([
      successfulJsonResponse({ not_a_lease_renew_receipt: true }),
    ], 60_000);
    const failure = await outcome.then(() => null, (error: unknown) => error);
    const transport = typedRuntimeTransportFailure(failure);
    assert.ok(transport, "an invalid receipt shape must surface as a typed transport failure");
    assert.equal(transport!.code, "AI_PRODUCTION_HTTP_ENVELOPE_INVALID");
    assert.equal(renewFailureRetryable(failure), false,
      "a 2xx response with an invalid receipt must not be retried");
    assert.equal(requestIds.length, 1);
  });
};

// S4.5: sustained 5xx must abort once the local remaining budget drops under 8s, with the last
// failure as cause, and the retry loop must never advance past that boundary.
const exerciseSustainedFailureAbortsAtBudgetFloor = async (): Promise<void> => {
  await withFakeClock(async () => {
    const failures = Array.from({ length: 20 }, () => typedErrorResponse(503, "AI_PRODUCTION_UPSTREAM_BUSY"));
    const { outcome, elapsedMs } = await exerciseRenewRetry(failures, 30_000);
    await assert.rejects(outcome, /AI_PRODUCTION_UPSTREAM_BUSY/u,
      "the last observed failure must be the abort cause");
    assert.ok(elapsedMs() <= 30_000 - 8_000,
      "the retry loop must stop before crossing the 8s-remaining floor");
  });
};

// S4.6: a retry near the budget floor must be truncated to less than the ordinary ~5s interval.
const exerciseRetryTruncatedNearBudgetFloor = async (): Promise<void> => {
  await withFakeClock(async () => {
    const j = job();
    const { outcome, elapsedMs } = await exerciseRenewRetry([
      typedErrorResponse(500, "AI_PRODUCTION_UPSTREAM_TRANSIENT"),
      successfulJsonResponse(renewReceipt({ job: j })),
    ], 10_000);
    await outcome;
    assert.ok(elapsedMs() < 5_000 && elapsedMs() > 0,
      "a retry within 10s of budget must be truncated below the ordinary 5s interval");
  });
};

// S4.7: an abort that fires while a retry is waiting must not let the loop issue another renew request.
const exerciseAbortDuringWaitStopsFurtherRequests = async (): Promise<void> => {
  await withFakeClock(async () => {
    const originalFetch = globalThis.fetch;
    const requestIds: string[] = [];
    globalThis.fetch = renewSessionFetch([
      typedErrorResponse(500, "AI_PRODUCTION_UPSTREAM_TRANSIENT"),
      successfulJsonResponse(renewReceipt({ job: job() })),
    ], requestIds);
    const session = await openedSession();
    const controller = new AbortController();
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((handler: (...args: unknown[]) => void, ms?: number) => {
      if ((ms ?? 0) >= 30_000) return originalSetTimeout(handler, ms);
      controller.abort("PRODUCTION_RUNTIME_STOPPED");
      queueMicrotask(handler);
      return originalSetTimeout(() => undefined, 0);
    }) as typeof setTimeout;
    try {
      await assert.rejects(renewWithinBudget({
        session, job: job(), budget: budgetWithLeftMs(60_000), signal: controller.signal,
      }), /AI_PRODUCTION_UPSTREAM_TRANSIENT/u);
      assert.equal(requestIds.length, 1,
        "an abort firing during the retry wait must prevent a second renew request");
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.fetch = originalFetch;
    }
  });
};

const exerciseBadSinkSessionBoundary = async (): Promise<void> => {
  const priorFetch = globalThis.fetch;
  let writable = true, calls = 0;
  const openFetch = renewSessionFetch([], []);
  globalThis.fetch = async (url, init) => {
    calls += 1;
    if (String(url).endsWith("/sessions/open")) return openFetch(url, init);
    return successfulJsonResponse({ readback: true });
  };
  const session = new ProductionWorkerSession(DeviceCredentialSchema.parse(validDeviceCredential),
    () => ({ agent_attested_in_flight: 0, browser_action_in_flight: 0, browser_authority_state: "present",
      browser_target_state: "absent", browser_lane_state: "idle", drain_state: "open", ledger_reconciled: true }),
    HASH_B, () => writable, "worker:sink");
  try {
    await session.open(); const identity = session.workerSessionId;
    const queued = session.request("/internal/ai-production/v6/jobs/test/provider-cooldown", { method: "POST", body: "{}" });
    writable = false;
    await assert.rejects(queued, /RUNTIME_LOG_SINK_WRITE_FAILED/u);
    await assert.rejects(session.heartbeat(), /RUNTIME_LOG_SINK_WRITE_FAILED/u);
    assert.equal(calls, 1); assert.equal(session.workerSessionId, identity);
    assert.equal(Reflect.get(session, "sequence"), 0);
    assert.deepEqual(await session.request("/exact-readback", { method: "GET" }), { readback: true });
    assert.equal(calls, 2);
    writable = true;
    let reply!: (response: Response) => void;
    globalThis.fetch = async () => { calls += 1; return new Promise<Response>(resolve => { reply = resolve; }); };
    const sent = session.request("/existing-send", { method: "POST", body: "{}" });
    while (!reply) await Promise.resolve();
    writable = false; reply(successfulJsonResponse({ readback: true }));
    assert.deepEqual(await sent, { readback: true }, "a dispatched response still completes when the sink fails");
    globalThis.fetch = async () => { calls += 1; return successfulJsonResponse({}); };
    await session.close(); assert.equal(calls, 4, "exact existing session close remains cleanup");
    await assert.rejects(session.open(), /RUNTIME_LOG_SINK_WRITE_FAILED/u); assert.equal(calls, 4);
  } finally { globalThis.fetch = priorFetch; }
};

const exerciseExecutorRejectDuringRenew = async (tick: () => Promise<void>, advance: (ms: number) => Promise<void>,
  timers: Readonly<{ size: number }>): Promise<void> => {
  const controller = new AbortController(), j = job(), failure = new Error("EXECUTOR_DURING_RENEW");
  let rejectExecutor!: () => void, replyRenew!: (reply: Response) => void, calls = 0, finished = false;
  const first = renewSessionFetch([], []), unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/sessions/open")) return first(url, init);
    calls += 1; return new Promise<Response>(resolve => { replyRenew = resolve; });
  };
  const session = await openedSession();
  const state = { session, runtimeLogger: { startSpan: () => ({ ok: true,
    event: { terminal: () => ({ ok: true, event: { eventId: "event:executor-reject" } }) } }) } };
  process.on("unhandledRejection", onUnhandled);
  try {
    const outcome = heartbeatWhileRunning({ state: state as never, job: j, budget: budgetWithLeftMs(60_000),
      abort: controller, parentSpanId: "span:executor-reject", execute: async () => {
        await new Promise<void>(resolve => { rejectExecutor = resolve; }); throw failure;
      } }).then(() => { throw new Error("EXECUTOR_REJECTION_MUST_NOT_SUCCEED"); },
        error => { finished = true; return error; });
    await tick(); await advance(20_000); assert.equal(calls, 1);
    rejectExecutor(); await tick(); await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(finished, false, "executor failure must still join the actual in-flight renew");
    assert.deepEqual(unhandled, []); assert.equal(calls, 1);
    replyRenew(successfulJsonResponse(renewReceipt({ job: j })));
    assert.equal(await outcome, failure, "the sole settlement consumer must throw the exact original error");
    assert.equal(controller.signal.aborted, false); assert.equal(timers.size, 0);
    assert.equal(getEventListeners(controller.signal, "abort").length, 0); assert.deepEqual(unhandled, []);
  } finally { process.removeListener("unhandledRejection", onUnhandled); }
  for (const mode of ["synchronous-callback", "executor-failure", "abort"] as const) {
    const controller = new AbortController();
    const outcome = heartbeatWhileRunning({ state: {} as never, job: job(), budget: budgetWithLeftMs(60_000),
      abort: controller, parentSpanId: "span:sync", execute: async stop => {
        if (mode === "abort") controller.abort("PRODUCTION_RUNTIME_STOPPED");
        if (mode === "executor-failure") throw new Error("EXECUTOR_FAILED");
        await stop(); await stop(); return 1;
      } }).then(() => true, () => false);
    assert.equal(await outcome, mode === "synchronous-callback"); assert.equal(timers.size, 0);
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  }
};

const exerciseSessionRequestBudget = async (tick: () => Promise<void>, advance: (ms: number) => Promise<void>,
  timers: Readonly<{ size: number }>): Promise<void> => {
  for (const mode of ["fetch-hung", "body-hung", "caller-abort", "pre-abort"] as const) {
    globalThis.fetch = renewSessionFetch([], []);
    const session = await openedSession(), controller = new AbortController();
    let physicalSignal: AbortSignal | undefined, requests = 0;
    globalThis.fetch = async (_url, init) => {
      requests++; physicalSignal = init?.signal ?? undefined;
      if (mode === "body-hung") return { ok: true, status: 200,
        json: () => new Promise(() => undefined) } as Response;
      return new Promise(() => undefined);
    };
    if (mode === "pre-abort") controller.abort("CALLER_STOPPED");
    const outcome = session.request("/renew-request-budget", { method: "POST", signal: controller.signal })
      .then(() => { throw new Error("UNKNOWN_REQUEST_MUST_NOT_SUCCEED"); }, error => error);
    await tick();
    if (mode === "caller-abort") controller.abort("CALLER_STOPPED");
    else if (mode !== "pre-abort") await advance(30_000);
    const failure = await outcome;
    assert.equal(failure.code, "CLOUD_TRANSPORT_UNAVAILABLE");
    assert.equal(requests, mode === "pre-abort" ? 0 : 1);
    if (physicalSignal) assert.equal(physicalSignal.aborted, true);
    assert.equal(timers.size, 0);
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  }
};
const exerciseRenewalCompletionModes = async (tick: () => Promise<void>, advance: (ms: number) => Promise<void>,
  timers: Readonly<{ size: number }>): Promise<void> => {
  for (const mode of ["success", "retry", "fence", "schema", "control", "budget"] as const) {
      const controller = new AbortController(), j = job();
      const responses: ((value: Response) => void)[] = [];
      let calls = 0, stage!: () => void, cleanup!: () => void, sent = false;
      const first = renewSessionFetch([], []);
      globalThis.fetch = async (url, init) => {
        if (String(url).endsWith("/sessions/open")) return first(url, init);
        calls += 1; return new Promise<Response>(resolve => { responses.push(resolve); });
      };
      const session = await openedSession();
      const state = { session, runtimeLogger: { startSpan: () => ({ ok: true,
        event: { terminal: () => ({ ok: true, event: { eventId: "event:renew-join" } }) } }) } };
      const outcome = heartbeatWhileRunning({ state: state as never, job: j, budget: budgetWithLeftMs(60_000),
        abort: controller, parentSpanId: "span:join",
        execute: async stop => {
          try { await new Promise<void>(resolve => { stage = resolve; }); await stop();
            sent = true;
          } finally { await new Promise<void>(resolve => { cleanup = resolve; }); }
          return "original-result";
        },
      }).then(value => ({ value }), error => ({ error }));
      await tick(); await advance(20_000); assert.equal(calls, 1);
      stage(); await tick(); assert.equal(sent, false, "terminal cannot pass the actual in-flight renew");
      if (mode === "retry") { responses.shift()!(typedErrorResponse(500, "AI_PRODUCTION_UPSTREAM_TRANSIENT"));
        await tick(); await advance(5_000); assert.equal(calls, 2); }
      const receipt = renewReceipt({ job: j });
      if (mode === "control") receipt.control_intent = { ...receipt.control_intent, intent: "cancel_requested" as never };
      if (mode === "budget") receipt.lease_expires_at = "2026-09-03T00:00:20.000Z";
      responses.shift()!(mode === "fence" ? typedErrorResponse(409, "AI_LEASE_FENCE_STALE")
        : successfulJsonResponse(mode === "schema" ? { invalid: true } : receipt));
      await tick(); assert.ok(cleanup); assert.equal(timers.size, 0, "stopped renewal owns no pending timer");
      assert.equal(getEventListeners(controller.signal, "abort").length, 0);
      const success = mode === "success" || mode === "retry";
      assert.equal(sent, success); assert.equal(controller.signal.aborted, !success);
      cleanup(); const result = await outcome;
      assert.equal("value" in result, success); assert.equal(calls, mode === "retry" ? 2 : 1);
    }
};

const exerciseRenewalCompletionJoin = async (): Promise<void> => {
  const original = { fetch: globalThis.fetch, setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout, now: Date.now, monotonic: performance.now };
  const timers = new Map<number, { run: () => void; ms: number }>();
  let id = 0, now = Date.parse("2026-09-03T00:00:00.000Z");
  const tick = async () => { for (let turn = 0; turn < 60; turn += 1) await Promise.resolve(); };
  const advance = async (ms: number) => {
    const timer = [...timers].find(([, entry]) => entry.ms === ms);
    assert.ok(timer, `missing actual timer:${ms}`);
    timers.delete(timer![0]); now += ms; timer![1].run(); await tick();
  };
  Date.now = () => now;
  performance.now = () => now - Date.parse("2026-09-03T00:00:00.000Z");
  globalThis.setTimeout = ((run: () => void, ms: number) => {
    const key = ++id; timers.set(key, { run, ms }); return key;
  }) as never;
  globalThis.clearTimeout = ((key: number) => { timers.delete(key); }) as never;
  try {
    await exerciseRenewalCompletionModes(tick, advance, timers);
    await exerciseExecutorRejectDuringRenew(tick, advance, timers);
    await exerciseSessionRequestBudget(tick, advance, timers);
    await exerciseMaterialLeaseBoundary(tick, advance, timers);
  } finally {
    globalThis.fetch = original.fetch; globalThis.setTimeout = original.setTimeout;
    globalThis.clearTimeout = original.clearTimeout; Date.now = original.now; performance.now = original.monotonic;
  }
};

export const exerciseLeaseRenewRetry = async (): Promise<void> => {
  await exerciseRenewalCompletionJoin();
  await exerciseBadSinkSessionBoundary();
  await exerciseSingleTransientRecovery();
  await exerciseNonJsonGatewayFailureRetries();
  await exerciseFenceStaleAbortsImmediately();
  await exerciseReceiptSchemaInvalidAbortsImmediately();
  await exerciseSustainedFailureAbortsAtBudgetFloor();
  await exerciseRetryTruncatedNearBudgetFloor();
  await exerciseAbortDuringWaitStopsFurtherRequests();
};
