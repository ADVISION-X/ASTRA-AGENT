import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import type { ProductionExecutionLease } from "../../src/lib/local-runtime/production/contracts.js";
import {
  renewFailureRetryable,
  renewWithinBudget,
} from "../../src/lib/local-runtime/production/runtime-execution-heartbeat.js";
import { typedRuntimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
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
    now += typeof ms === "number" ? ms : 0;
    handler();
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
        worker_session_epoch: 1, control_contract_version: 38 },
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
    async () => ({ agent_attested_in_flight: 0, browser_action_in_flight: 0, browser_authority_state: "present",
      browser_target_state: "absent", browser_lane_state: "idle", drain_state: "open", ledger_reconciled: true }),
    HASH_B, "worker-instance:renew-retry",
  );
  await session.open();
  return session;
};

const budgetWithLeftMs = (leftMs: number): ProductionExecutionLease => ({
  attempt_id: "attempt:renew-retry", device_id: validDeviceCredential.device_id, lease_version: 1,
  execution_fence_hash: HASH_A, capability_manifest_hash: HASH_B,
  max_provider_turns: 8, result_revision: 0, prior_result_rejection: null, provider_turns_used: 0,
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
    globalThis.setTimeout = ((handler: (...args: unknown[]) => void) => {
      controller.abort("PRODUCTION_RUNTIME_STOPPED");
      handler();
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

export const exerciseLeaseRenewRetry = async (): Promise<void> => {
  await exerciseSingleTransientRecovery();
  await exerciseNonJsonGatewayFailureRetries();
  await exerciseFenceStaleAbortsImmediately();
  await exerciseReceiptSchemaInvalidAbortsImmediately();
  await exerciseSustainedFailureAbortsAtBudgetFloor();
  await exerciseRetryTruncatedNearBudgetFloor();
  await exerciseAbortDuringWaitStopsFurtherRequests();
};
