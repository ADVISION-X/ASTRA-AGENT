import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRuntimeLogger, requireRuntimeLogWrite, RuntimeFailureImpact, withRuntimeLogCause } from "../../src/lib/runtime-logs/index.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { workerLoop, reconcileCompletedBrowserTargets } from "../../src/lib/local-runtime/production/runtime-loops.js";
import { shutdownRuntime } from "../../src/lib/local-runtime/production/runtime-startup.js";
import { executionFailure } from "../../src/lib/execution-failure.js";
import { serializeTerminalFailure } from "../../src/lib/local-runtime/production/terminal-failure.js";
import { reconcileBusinessAdmission } from "../../src/lib/local-runtime/production/runtime-business-admission.js";
import { terminalSpanFailure } from "../../src/lib/local-runtime/production/runtime-logging.js";
import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";

import { claimProductionTasks } from "../../src/lib/local-runtime/production/cloud-client.js";
import { DeviceCredentialSchema } from
  "../../src/lib/local-runtime/production/transport-protocol.js";
import { ProductionWorkerSession } from
  "../../src/lib/local-runtime/production/worker-session.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { HASH_A, HASH_B, HASH_C, task, resultFor, stageResultForAcceptance,
  attemptFailureFirstFact, failureStatus, shutdownRuntimeFixture, admissionReceiptFor,
  deviceStatusWithoutAdmission, deviceStatusWithAdmission } from "./agent-production-runtime-fixtures.js";

const deferred = () => {
  let release: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release: (): void => release!() };
};

const assertActiveTaskDrain = async (): Promise<void> => {
  for (const unresolved of [false, true]) {
    const dataDir = await mkdtemp(path.join(tmpdir(), "shutdown-active-"));
    const store = new ProductionRuntimeStore(dataDir);
    const logger = createRuntimeLogger({ producer: "shutdown-active", owner: "production-runtime",
      component: "production-runtime", terminalEnabled: false, fileSink: { directoryPath: path.join(dataDir, "logs") } });
    const state = shutdownRuntimeFixture({ store, dataDir, runtimeLogger: logger,
      browser: { hasUnresolvedBrowserMutation: () => unresolved } });
    let closed = false, sessionClosed = 0, passes = 0;
    const realClose = store.close.bind(store);
    store.close = () => { closed = true; realClose(); };
    state.session.close = async () => { sessionClosed++; };
    const original = deferred(), late = deferred(), iteration = deferred(), productAbort = new AbortController();
    for (const jobId of ["original", "late-grant"]) {
      const candidate = task({ jobId, productId: "bazi_ai_full_analysis", actionId: "produce" });
      store.acceptTask(candidate, "attempt:shutdown");
      const result = resultFor(candidate); stageResultForAcceptance(store, jobId, "attempt:shutdown", result);
      store.completeTask(jobId, result); store.settleBrowserCleanup(jobId);
    }
    state.active.set("original", original.promise); state.activeAbort.set("original", productAbort);
    state.iteration = iteration.promise.then(() => 0);
    const closing = shutdownRuntime(state, Promise.resolve(), Promise.resolve(), async () => { passes++; });
    const observed = closing.then(() => null, (error: unknown) => error);
    try {
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(closed, false, "active work must finish before Store closes");
      assert.equal(sessionClosed, 0); assert.equal(productAbort.signal.aborted, false);
      state.active.set("late-grant", late.promise); iteration.release(); original.release();
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(closed, false, "the already-sent claim's late grant must finish too");
      late.release(); const error = await observed;
      if (unresolved) assert.match(String(error), /RUNTIME_SHUTDOWN_INCOMPLETE/u); else assert.equal(error, null);
      assert.equal(closed, true); assert.equal(sessionClosed, 1); assert.equal(passes, 1);
      assert.equal(productAbort.signal.aborted, false);
      const events = (await readFile(logger.currentSegmentPath()!, "utf8")).trim().split("\n").map(row => JSON.parse(row));
      const terminal = events.find(event => event.kind === "span.terminal" && event.operation === "runtime.shutdown");
      assert.equal(terminal.outcome, unresolved ? "failed" : "succeeded");
      if (unresolved) assert.equal(terminal.failure.code, "RUNTIME_SHUTDOWN_BROWSER_UNRESOLVED");
    } finally { original.release(); late.release(); iteration.release(); await observed;
      if (!closed) realClose(); await rm(dataDir, { recursive: true, force: true }); }
  }
};

const assertFinalResultDrain = async (): Promise<void> => {
  for (const scenario of ["last-admission", "original-cause"] as const) {
    const dataDir = await mkdtemp(path.join(tmpdir(), "shutdown-final-")), store = new ProductionRuntimeStore(dataDir);
    const receipts = new Map<string, ReturnType<typeof stageResultForAcceptance>>();
    for (const jobId of ["last-a", "last-b"]) {
      const candidate = task({ jobId, productId: "bazi_ai_full_analysis", actionId: "produce" });
      store.acceptTask(candidate, "attempt:final"); receipts.set(jobId, stageResultForAcceptance(store, jobId, "attempt:final", resultFor(candidate)));
      if (scenario === "original-cause") { store.completeTask(jobId, resultFor(candidate)); store.settleBrowserCleanup(jobId); }
    }
    const logger = createRuntimeLogger({ producer: "shutdown-final", owner: "production-runtime",
      component: "production-runtime", terminalEnabled: false, fileSink: { directoryPath: path.join(dataDir, "logs") } });
    const prior = requireRuntimeLogWrite(logger.startSpan({ traceId: "prior-claim", owner: "production-runtime",
      component: "production-session", operation: "cloud.claim", typedIdentity: { kind: "producer", producerId: logger.producerRunId } }));
    const error = runtimeTransportFailure("CLAIM_CONNECTION_RESET", 503, Object.assign(new Error("reset"), { code: "ECONNRESET" }));
    const priorTerminal = terminalSpanFailure(prior, error, null, error.code, undefined, "website");
    let passes = 0, cleanup = 0;
    const state = shutdownRuntimeFixture({ store, dataDir, runtimeLogger: logger,
      browser: { releaseJobBoundTarget: async () => { cleanup++; } } });
    state.session.close = async () => {};
    state.session.request = async requestPath => {
      const jobId = decodeURIComponent(requestPath.split("/").at(-2)!);
      const result = resultFor(store.readTask(jobId)!.task);
      const fixture = passes === 0 ? deviceStatusWithoutAdmission(jobId)
        : deviceStatusWithAdmission(admissionReceiptFor(jobId, result.result_payload_hash), jobId, hashCanonical(result), null, [receipts.get(jobId)!]);
      return await (fixture as { request(): Promise<unknown> }).request();
    };
    state.iteration = scenario === "original-cause" ? Promise.reject(withRuntimeLogCause(error, priorTerminal.eventId)) : null;
    try {
      const closing = shutdownRuntime(state, Promise.resolve(), Promise.resolve(), async () => {
        passes++; for (const record of store.pendingBusinessAdmissions()) await reconcileBusinessAdmission(state, record);
        await reconcileCompletedBrowserTargets(state);
      });
      if (scenario === "original-cause") await assert.rejects(closing, /RUNTIME_SHUTDOWN_INCOMPLETE/u); else await closing;
      const events = (await readFile(logger.currentSegmentPath()!, "utf8")).trim().split("\n").map(row => JSON.parse(row));
      const terminal = events.find(event => event.kind === "span.terminal" && event.operation === "runtime.shutdown");
      if (scenario === "last-admission") {
        assert.equal(terminal.outcome, "succeeded"); assert.equal(passes, 2); assert.equal(cleanup, 2);
      } else {
        assert.equal(terminal.failure.code, error.code); assert.equal(terminal.failure.impact, RuntimeFailureImpact.CONSEQUENTIAL);
        assert.equal(terminal.failure.causedByEventId, priorTerminal.eventId);
        assert.equal(terminal.failure.nativeCause, "ECONNRESET"); assert.equal(terminal.failure.responsibleOwner, "website");
      }
    } finally { await rm(dataDir, { recursive: true, force: true }); }
  }
};

export const assertShutdownFailureOutcomes = async (): Promise<void> => {
  await assertActiveTaskDrain();
  await assertFinalResultDrain();
  for (const scenario of ["cooldown", "session-close", "failure-matches", "failure-unconfirmed", "failure-conflict", "failure-receipt-conflict"] as const) {
    const directory = await mkdtemp(path.join(tmpdir(), "shutdown-failure-outcome-"));
    const store = new ProductionRuntimeStore(directory);
    const candidate = task({ jobId: "shutdown-failure", productId: "bazi_ai_full_analysis", actionId: "produce" });
    store.acceptTask(candidate, "attempt:failure");
    const fact = attemptFailureFirstFact("attempt:failure", serializeTerminalFailure(executionFailure("failed", "PROVIDER_REJECTED")));
    if (scenario.startsWith("failure")) store.recordAttemptFailure(candidate.job_id, "attempt:failure", fact);
    else {
      const result = resultFor(candidate); stageResultForAcceptance(store, candidate.job_id, "attempt:failure", result);
      store.completeTask(candidate.job_id, result); store.settleBrowserCleanup(candidate.job_id);
    }
    const cooldownKey = "aipcooldown_0123456789abcdef0123456789abcdef01234567";
    if (scenario === "cooldown") store.enqueue({ idempotency_key: cooldownKey, kind: "provider_cooldown", method: "POST",
      path: `/internal/ai-production/v6/jobs/${candidate.job_id}/provider-cooldown`, headers: {},
      body: JSON.stringify({ schema_version: "xuanxue-ai-provider-cooldown-notice.v7",
        request_id: cooldownKey, incident_request_id: cooldownKey, phase: "incident", clearance: "pending_unknown",
        job_id: candidate.job_id, attempt_id: "attempt:failure", result_revision: 0, lease_version: 1,
        fence_hash: HASH_A, capability_manifest_hash: HASH_A, gpt_session_key: "product:shutdown",
        observed_at: "2030-01-01T00:00:00.000Z", worker_instance_id: "worker:shutdown",
        session_open_request_id: "aipsopen-shutdown", dialog_hash: HASH_A, observation_hash: HASH_A }) });
    const originalIdentity = store.providerCooldownSessionRecoveryIdentity();
    const before = store.taskAuthorities(); let closed = false, sessionClosed = 0;
    const realClose = store.close.bind(store); store.close = () => { closed = true; realClose(); };
    const logger = createRuntimeLogger({ producer: "shutdown-failure", owner: "production-runtime",
      component: "production-runtime", terminalEnabled: false, fileSink: { directoryPath: path.join(directory, "logs") } });
    const remote = scenario === "failure-unconfirmed" ? null : { ...fact.failure_core, from_status: "failed", to_status: "failed",
      attempt_id: scenario === "failure-conflict" ? "attempt:foreign" : "attempt:failure", lease_version: 1 };
    const state = shutdownRuntimeFixture({ store, dataDir: directory, runtimeLogger: logger });
    const receipt = { request_id: fact.release_descriptor.request_id, write_kind: "lease_release",
      payload_hash: fact.release_descriptor.write_request_payload_hash, response_json: {} };
    state.session.request = async () => failureStatus(candidate.job_id, remote,
      scenario === "failure-receipt-conflict" ? [receipt, receipt] : []);
    state.session.close = async () => {
      sessionClosed++; if (scenario === "session-close") throw executionFailure("failed", "CLOUD_SESSION_CLOSE_UNKNOWN");
    };
    try {
      await assert.rejects(shutdownRuntime(state, Promise.resolve(), Promise.resolve(), async () => {}), /RUNTIME_SHUTDOWN_INCOMPLETE/u);
      assert.equal(closed, true); assert.equal(sessionClosed, scenario === "cooldown" ? 0 : 1);
      const events = (await readFile(logger.currentSegmentPath()!, "utf8")).trim().split("\n").map(row => JSON.parse(row));
      const terminal = events.find(event => event.kind === "span.terminal" && event.operation === "runtime.shutdown");
      assert.equal(terminal.outcome, "failed");
      const expected = {
        "failure-matches": "PROVIDER_REJECTED", "failure-unconfirmed": "RUNTIME_SHUTDOWN_FAILURE_UNCONFIRMED",
        "failure-conflict": "PRODUCTION_ATTEMPT_FAILURE_AUTHORITY_CONFLICT",
        "failure-receipt-conflict": "PRODUCTION_ATTEMPT_FAILURE_RECEIPT_CONFLICT",
        cooldown: "RUNTIME_SHUTDOWN_OUTBOX_PENDING", "session-close": "CLOUD_SESSION_CLOSE_UNKNOWN",
      }[scenario];
      assert.equal(terminal.failure.code, expected);
      if (scenario === "failure-matches") {
        assert.equal(terminal.authorityRef, `production-task:${candidate.job_id}`);
        assert.equal(terminal.authorityHash, hashCanonical(before[0]));
      }
      const reopened = new ProductionRuntimeStore(directory);
      assert.deepEqual(reopened.taskAuthorities(), before);
      assert.deepEqual(reopened.providerCooldownSessionRecoveryIdentity(), originalIdentity);
      if (scenario === "cooldown") assert.equal(reopened.readOutboxAuthority(cooldownKey)?.state, "pending");
      reopened.close();
    } finally { if (!closed) realClose(); await rm(directory, { recursive: true, force: true }); }
  }
};

const exerciseStoppedClaimRuntime = async (session: ProductionWorkerSession,
  rotation: RotationState, stop: () => void): Promise<void> => {
  const directory = await mkdtemp(path.join(tmpdir(), "stopped-claim-runtime-"));
  const store = new ProductionRuntimeStore(directory);
  const logger = createRuntimeLogger({ producer: "stopped-claim-runtime", owner: "production-runtime",
    component: "production-runtime", terminalEnabled: false, fileSink: { directoryPath: path.join(directory, "logs") } });
  const runtime = shutdownRuntimeFixture({ store, dataDir: directory, runtimeLogger: logger, session });
  const original = session.requestClaim.bind(session), sent = rotation.claimCount;
  session.requestClaim = (...args) => {
    const pending = original(...args); stop(); runtime.draining = true; return pending;
  };
  try {
    await workerLoop(runtime, () => runtime.abort.abort());
    assert.equal(rotation.claimCount, sent, "the original Runtime claim also sends zero HTTP after stopping");
    const events = (await readFile(logger.currentSegmentPath()!, "utf8")).trim().split("\n").map(row => JSON.parse(row));
    const terminal = events.filter(event => event.kind === "span.terminal" && event.operation === "cloud.claim");
    assert.equal(terminal.length, 1); assert.equal(terminal[0].outcome, "succeeded");
    assert.equal(Object.hasOwn(terminal[0], "claimDiagnostics"), false,
      "an unsent claim has no Website receipt and must not invent Website diagnostics");
    assert.equal(events.filter(event => event.failure).length, 0, "a local unsent stop is never a Website failure root");
  } finally { session.requestClaim = original; store.close(); await rm(directory, { recursive: true, force: true }); }
};

const credentialFor = (generation: number) => ({
  schema_version: "xuanxue-ai-worker-session-credential.v6" as const,
  worker_session_id: "worker-session:atomic-claim", worker_session_epoch: 1,
  token: `aisc_v6_${String(generation).repeat(40)}`, token_generation: generation,
  issued_at: "2026-09-03T00:00:00.000Z", expires_at: "2099-09-03T00:00:00.000Z",
  previous_generation_valid_until: null,
});

const attestationFor = (
  sequence: number,
  receiptHash: string,
  expiresAt = "2099-09-03T00:00:00.000Z",
) => ({
  schema_version: "xuanxue-ai-runtime-attestation-receipt.v6" as const,
  receipt_id: `attestation:${sequence}`, receipt_hash: receiptHash,
  worker_session_id: "worker-session:atomic-claim", worker_session_epoch: 1,
  attestation_seq: sequence, payload_hash: HASH_A, server_signature: HASH_C,
  issued_at: "2026-09-03T00:00:00.000Z", expires_at: expiresAt,
  claim_eligible: true, reason_codes: [],
});

const successfulJsonResponse = (data: unknown): Response => new Response(
  JSON.stringify({ ok: true, data }),
  { status: 200, headers: { "content-type": "application/json" } },
);

type RotationSignals = Readonly<{
  heartbeatRotationEntered: ReturnType<typeof deferred>;
  heartbeatRotationRelease: ReturnType<typeof deferred>;
  delayedClaimEntered: ReturnType<typeof deferred>;
  delayedClaimRelease: ReturnType<typeof deferred>;
  claimTwoEntered: ReturnType<typeof deferred>;
  claimTwoRelease: ReturnType<typeof deferred>;
}>;

type RotationState = {
  heartbeatCount: number;
  claimCount: number;
  attestedInFlight: number;
  observedHeartbeatInFlight: number[];
  observedClaimHashes: string[];
  observedClaimTokens: string[];
  tamperClaimHash: boolean;
};

const createSessionFetch = (
  state: RotationState,
  signals: RotationSignals,
): typeof globalThis.fetch => async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  if (url.endsWith("/internal/ai-production/v6/sessions/open")) return successfulJsonResponse({
    session: {
      device_id: "device:atomic-claim", worker_session_id: "worker-session:atomic-claim",
      worker_session_epoch: 1, control_contract_version: 47, attestation_seq: 0,
    },
    session_credential: credentialFor(1),
  });
  if (url.endsWith("/heartbeat")) {
    const heartbeatNumber = ++state.heartbeatCount;
    if (heartbeatNumber === 3) {
      signals.heartbeatRotationEntered.release();
      await signals.heartbeatRotationRelease.promise;
    }
    if (typeof init?.body !== "string") throw new Error("HEARTBEAT_BODY_MISSING");
    const heartbeatBody = JSON.parse(init.body) as { agent_attested_in_flight?: number };
    state.observedHeartbeatInFlight.push(Number(heartbeatBody.agent_attested_in_flight));
    const receiptHash = [HASH_A, HASH_B, HASH_C, HASH_A, HASH_B][heartbeatNumber - 1];
    if (!receiptHash) throw new Error("UNEXPECTED_HEARTBEAT_COUNT");
    return successfulJsonResponse({
      attestation_receipt: attestationFor(heartbeatNumber, receiptHash,
        heartbeatNumber === 1 ? new Date(Date.now() + 34_999).toISOString() : undefined),
      session_credential: credentialFor(heartbeatNumber + 1),
    });
  }
  if (!url.endsWith("/internal/ai-production/v6/jobs/claim")) {
    throw new Error(`UNEXPECTED_SESSION_URL:${url}`);
  }
  const claimNumber = ++state.claimCount;
  if (typeof init?.body !== "string") throw new Error("CLAIM_BODY_MISSING");
  const body = JSON.parse(init.body) as Record<string, unknown>;
  if (typeof body.runtime_attestation_receipt_hash !== "string") throw new Error("CLAIM_HASH_MISSING");
  state.observedClaimHashes.push(body.runtime_attestation_receipt_hash);
  state.observedClaimTokens.push(new Headers(init.headers).get("authorization") ?? "");
  if (claimNumber === 1) {
    signals.delayedClaimEntered.release();
    await signals.delayedClaimRelease.promise;
  }
  if (claimNumber === 3) {
    signals.claimTwoEntered.release();
    await signals.claimTwoRelease.promise;
  }
  return successfulJsonResponse({
    schema_version: "xuanxue-ai-claim-batch-receipt.v6", claim_batch_id: `claim-batch:${claimNumber}`,
    request_id: body.request_id,
    request_payload_hash: state.tamperClaimHash ? HASH_A : hashCanonical(body),
    outcome: "NO_ELIGIBLE_JOB", jobs: [],
    server_now: "2026-09-03T00:00:00.000Z", next_claim_after_ms: 3_000, queue_epoch: claimNumber,
    reason_codes: ["NO_UNFINISHED_V6_DEMAND"],
  });
};

const exerciseClaimOrdering = async (
  session: ProductionWorkerSession,
  state: RotationState,
  signals: RotationSignals,
): Promise<void> => {
  await session.heartbeat();
  await exerciseNearExpiryClaim(session, state, signals);
  await exerciseClaimAfterRotation(session, state, signals);
  await exerciseHeartbeatAfterClaim(session, state, signals);
  state.attestedInFlight = 4;
  const forced = await claimProductionTasks(
    session, 1, "claim:full-capacity-recovery", true,
  );
  assert.equal(forced.outcome, "NO_ELIGIBLE_JOB");
  assert.equal(state.heartbeatCount, 5,
    "a full-capacity recovery claim must force a current heartbeat despite a valid cached receipt");
  assert.equal(state.observedHeartbeatInFlight[4], 4,
    "the forced heartbeat must carry the current full business denominator");
  assert.equal(state.observedClaimHashes[3], HASH_B,
    "the recovery claim must bind the receipt produced by the forced heartbeat");
  assert.equal(state.observedClaimTokens[3], `Bearer ${credentialFor(6).token}`);
};

const exerciseNearExpiryClaim = async (
  session: ProductionWorkerSession,
  state: RotationState,
  signals: RotationSignals,
): Promise<void> => {
  const delayedNearExpiryClaim = claimProductionTasks(session, 1, "claim:near-expiry");
  await signals.delayedClaimEntered.promise;
  assert.equal(state.heartbeatCount, 2,
    "claim must refresh an attestation that cannot cover its transport timeout");
  assert.equal(state.observedClaimHashes[0], HASH_B);
  assert.equal(state.observedClaimTokens[0], `Bearer ${credentialFor(3).token}`);
  signals.delayedClaimRelease.release();
  await delayedNearExpiryClaim;
};

const exerciseClaimAfterRotation = async (
  session: ProductionWorkerSession,
  state: RotationState,
  signals: RotationSignals,
): Promise<void> => {
  const rotatingHeartbeat = session.heartbeat();
  await signals.heartbeatRotationEntered.promise;
  const claimAfterRotation = claimProductionTasks(session, 1, "claim:after-rotation");
  await new Promise<void>((resolve) => { setImmediate(resolve); });
  assert.equal(state.claimCount, 1,
    "claim must wait while Website has rotated authority but AGENT lacks the response");
  signals.heartbeatRotationRelease.release();
  await rotatingHeartbeat;
  assert.equal((await claimAfterRotation).outcome, "NO_ELIGIBLE_JOB");
  assert.equal(state.observedClaimHashes[1], HASH_C);
  assert.equal(state.observedClaimTokens[1], `Bearer ${credentialFor(4).token}`);
};

const exerciseHeartbeatAfterClaim = async (
  session: ProductionWorkerSession,
  state: RotationState,
  signals: RotationSignals,
): Promise<void> => {
  const inFlightClaim = claimProductionTasks(session, 6, "claim:before-rotation");
  await signals.claimTwoEntered.promise;
  const heartbeatAfterClaim = session.heartbeat();
  await new Promise<void>((resolve) => { setImmediate(resolve); });
  assert.equal(state.heartbeatCount, 3,
    "heartbeat must not rotate authority before an in-flight claim settles");
  signals.claimTwoRelease.release();
  assert.equal((await inFlightClaim).outcome, "NO_ELIGIBLE_JOB");
  await heartbeatAfterClaim;
  assert.equal(state.heartbeatCount, 4);
  assert.deepEqual(state.observedClaimHashes, [HASH_B, HASH_C, HASH_C]);
};

export const exerciseWorkerSessionRotation = async (): Promise<void> => {
  const state: RotationState = {
    heartbeatCount: 0, claimCount: 0, attestedInFlight: 0,
    observedHeartbeatInFlight: [], observedClaimHashes: [], observedClaimTokens: [],
    tamperClaimHash: false,
  };
  const signals: RotationSignals = {
    heartbeatRotationEntered: deferred(), heartbeatRotationRelease: deferred(),
    delayedClaimEntered: deferred(), delayedClaimRelease: deferred(),
    claimTwoEntered: deferred(), claimTwoRelease: deferred(),
  };
  const originalFetch = globalThis.fetch;
  const originalDateNow = Date.now;
  Date.now = () => Date.parse("2026-09-03T00:00:00.000Z");
  globalThis.fetch = createSessionFetch(state, signals);
  try {
    const device = DeviceCredentialSchema.parse({
      protocol_version: "xuanxue-ai-production-v6", server_base_url: "http://127.0.0.1:3000",
      environment_id: "production", origin: "http://localhost:3000", device_id: "device:atomic-claim",
      device_epoch: 1, credential: `aidc_v6_${"d".repeat(40)}`,
      enrolled_at: "2026-09-03T00:00:00.000Z",
    });
    let stopping = false;
    const session = new ProductionWorkerSession(device, () => ({
      agent_attested_in_flight: state.attestedInFlight,
      browser_action_in_flight: 0, browser_authority_state: "present",
      browser_target_state: "absent", browser_lane_state: "idle", drain_state: stopping ? "draining" : "open",
      ledger_reconciled: true,
    }), HASH_B, () => true, "worker-instance:atomic-claim");
    await exerciseClaimOrdering(session, state, signals);
    state.tamperClaimHash = true;
    await assert.rejects(
      claimProductionTasks(session, 1, "claim:payload-hash-mismatch"),
      /V6_CLAIM_RECEIPT_MISMATCH/u,
      "a receipt for a different canonical claim request must fail closed",
    );
    state.tamperClaimHash = false;
    const sentBeforeStop = state.claimCount;
    const queued = session.requestClaim("claim:stop-queued", 1);
    stopping = true;
    await assert.rejects(queued, /PRODUCTION_CLAIM_STOPPED/u);
    assert.equal(state.claimCount, sentBeforeStop, "a queued claim cannot send HTTP after stop intent");
    stopping = false;
    await exerciseStoppedClaimRuntime(session, state, () => { stopping = true; });
  } finally {
    Date.now = originalDateNow;
    globalThis.fetch = originalFetch;
  }
};

export const exerciseHeartbeatResponseLossRecovery = async (): Promise<void> => {
  const originalFetch = globalThis.fetch;
  const originalDateNow = Date.now;
  Date.now = () => Date.parse("2026-09-03T00:00:00.000Z");
  let opens = 0;
  let serverSequence = 0;
  let serverGeneration = 1;
  let loseFirstHeartbeatResponse = true;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.endsWith("/sessions/open")) {
      opens += 1;
      return successfulJsonResponse({
        session: { device_id: "device:atomic-claim", worker_session_id: "worker-session:atomic-claim",
          worker_session_epoch: 1, control_contract_version: 47, attestation_seq: serverSequence },
        session_credential: credentialFor(serverGeneration),
      });
    }
    if (!url.endsWith("/heartbeat") || typeof init?.body !== "string") {
      throw new Error(`UNEXPECTED_HEARTBEAT_RECOVERY_URL:${url}`);
    }
    const body = JSON.parse(init.body) as { attestation_seq: number };
    assert.equal(body.attestation_seq, serverSequence + 1,
      "a remote-committed heartbeat must advance the next local sequence after exact open replay");
    serverSequence += 1;
    serverGeneration += 1;
    if (loseFirstHeartbeatResponse) {
      loseFirstHeartbeatResponse = false;
      throw new TypeError("heartbeat response lost after remote commit");
    }
    return successfulJsonResponse({
      attestation_receipt: attestationFor(serverSequence, HASH_A),
      session_credential: credentialFor(serverGeneration),
    });
  };
  try {
    const device = DeviceCredentialSchema.parse({
      protocol_version: "xuanxue-ai-production-v6", server_base_url: "http://127.0.0.1:3000",
      environment_id: "production", origin: "http://localhost:3000", device_id: "device:atomic-claim",
      device_epoch: 1, credential: `aidc_v6_${"d".repeat(40)}`,
      enrolled_at: "2026-09-03T00:00:00.000Z",
    });
    const session = new ProductionWorkerSession(device, () => ({
      agent_attested_in_flight: 0, browser_action_in_flight: 0,
      browser_authority_state: "present", browser_target_state: "absent",
      browser_lane_state: "idle", drain_state: "open", ledger_reconciled: true,
    }), HASH_B, () => true, "worker-instance:atomic-claim");
    await assert.rejects(session.heartbeat(), /CLOUD_TRANSPORT_UNAVAILABLE/u);
    assert.equal(opens, 2, "the same open request must resynchronize the original session");
    assert.equal(serverSequence, 1);
    const recovered = await session.heartbeat();
    assert.equal(recovered.attestation_seq, 2);
    assert.equal(serverSequence, 2);
    assert.equal(opens, 2, "recovery must not allocate another session");
  } finally {
    Date.now = originalDateNow;
    globalThis.fetch = originalFetch;
  }
};
