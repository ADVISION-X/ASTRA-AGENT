import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";

import { claimProductionTasks } from "../../src/lib/local-runtime/production/cloud-client.js";
import { DeviceCredentialSchema } from
  "../../src/lib/local-runtime/production/transport-protocol.js";
import { ProductionWorkerSession } from
  "../../src/lib/local-runtime/production/worker-session.js";
import { HASH_A, HASH_B, HASH_C } from "./agent-production-runtime-fixtures.js";

const deferred = () => {
  let release: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release: (): void => release!() };
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
  observedClaimHashes: string[];
  observedClaimTokens: string[];
};

const createSessionFetch = (
  state: RotationState,
  signals: RotationSignals,
): typeof globalThis.fetch => async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  if (url.endsWith("/internal/ai-production/v6/sessions/open")) return successfulJsonResponse({
    session: {
      device_id: "device:atomic-claim", worker_session_id: "worker-session:atomic-claim",
      worker_session_epoch: 1, control_contract_version: 29,
    },
    session_credential: credentialFor(1),
  });
  if (url.endsWith("/heartbeat")) {
    const heartbeatNumber = ++state.heartbeatCount;
    if (heartbeatNumber === 3) {
      signals.heartbeatRotationEntered.release();
      await signals.heartbeatRotationRelease.promise;
    }
    const receiptHash = [HASH_A, HASH_B, HASH_C, HASH_A][heartbeatNumber - 1];
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
    request_id: body.request_id, request_payload_hash: HASH_A, outcome: "NO_ELIGIBLE_JOB", jobs: [],
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
  const inFlightClaim = claimProductionTasks(session, 1, "claim:before-rotation");
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
    heartbeatCount: 0, claimCount: 0, observedClaimHashes: [], observedClaimTokens: [],
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
    const session = new ProductionWorkerSession(device, async () => ({
      business_in_flight: 0, browser_action_in_flight: 0, browser_authority_state: "present",
      browser_target_state: "absent", browser_lane_state: "idle", drain_state: "open",
      ledger_reconciled: true,
    }), HASH_B, "worker-instance:atomic-claim");
    await exerciseClaimOrdering(session, state, signals);
  } finally {
    Date.now = originalDateNow;
    globalThis.fetch = originalFetch;
  }
};
