import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { executionFailure } from "../../src/lib/execution-failure.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import {
  ProductionRuntimeStore,
  type ProductionOutboxWrite,
} from "../../src/lib/local-runtime/production/store.js";
import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import { throwStaleFenceReadbackFailure } from
  "../../src/lib/local-runtime/production/runtime-stale-fence-reconciliation.js";
import {
  HASH_A,
  HASH_B,
  claimTask,
  identityFor,
  recoveryCheckpointBody,
  recoveryCheckpointReceipt as checkpointReceipt,
  task,
} from "./agent-production-runtime-fixtures.js";

async function deliverExactStaleFence(
  store: ProductionRuntimeStore,
  database: Database.Database,
) {
  const accepted = task({
    jobId: "job:stale-fence", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const job = claimTask(accepted);
  store.acceptTask(accepted, identityFor(accepted), job.grant.attempt_id);
  const pathname = `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/checkpoints`;
  const body = recoveryCheckpointBody({
    jobId: job.job_id, attemptId: job.grant.attempt_id,
    requestId: "stale-fence:accepted:1", checkpointSeq: 1, checkpointKind: "accepted",
  });
  store.enqueue({
    idempotency_key: body.request_id, kind: "checkpoint", path: pathname, method: "POST",
    headers: { "x-ai-execution-fence-hash": HASH_A }, body: JSON.stringify(body),
  });
  await assert.rejects(store.deliverOutbox(body.request_id, async () => {
    throw runtimeTransportFailure("AI_LEASE_FENCE_STALE", 409);
  }), /AI_LEASE_FENCE_STALE/u);
  assert.deepEqual(store.readOutboxAuthority(body.request_id), {
    idempotencyKey: body.request_id,
    jobId: job.job_id,
    kind: "checkpoint",
    state: "pending",
    nextDeliveryAt: null,
    lastError: "WEBSITE_HTTP_409:AI_LEASE_FENCE_STALE",
    responseHash: null,
    receiptHash: null,
  });
  assert.equal(store.pendingOutbox().length, 0,
    "a Website-confirmed stale fence must not re-enter the global flusher");
  const before = database.prepare(`select idempotency_key,kind,path,method,headers_json,
    cast(body_blob as text) as body,created_at,sent_at,response_hash from production_outbox
    where idempotency_key=?`).get(body.request_id) as Record<string, unknown>;
  let sendCount = 0;
  const deliveredWrites: ProductionOutboxWrite[] = [];
  let response: Record<string, unknown> | null = null;
  const delivery = await store.deliverReauthorizedStaleCheckpoint({
    jobId: job.job_id,
    attemptId: job.grant.attempt_id,
    workerSessionId: "worker:2",
    workerSessionEpoch: 2,
    leaseVersion: 2,
    fenceHash: HASH_B,
    receipts: [],
  }, async (fresh) => {
    sendCount += 1;
    deliveredWrites.push(fresh);
    const sentBody = JSON.parse(Buffer.from(fresh.body).toString("utf8")) as Record<string, unknown>;
    response = {
      schema_version: "xuanxue-ai-checkpoint-receipt.v6",
      job_id: job.job_id,
      checkpoint_seq: 1,
      checkpoint_hash: hashCanonical(sentBody),
      accepted_at: "2026-09-09T17:00:00.000Z",
      accepted_attempt_count: 1,
      status: "failed",
    };
    return response;
  });
  return { job, body, pathname, before, sendCount, deliveredWrites, response, delivery };
}

function assertExactStaleFence(
  store: ProductionRuntimeStore,
  database: Database.Database,
  result: Awaited<ReturnType<typeof deliverExactStaleFence>>,
): void {
  const { job, body, pathname, before, sendCount, deliveredWrites, response, delivery } = result;
  assert.equal(delivery.requestId, body.request_id);
  assert.equal(delivery.deliveryError, null);
  assert.equal(deliveredWrites.length, 1);
  const write = deliveredWrites[0]!;
  assert.ok(write);
  assert.equal(write.idempotency_key, body.request_id);
  assert.equal(write.path, pathname);
  assert.equal(write.method, "POST");
  assert.deepEqual(write.headers, { "x-ai-execution-fence-hash": HASH_B });
  const reauthorizedBody = JSON.parse(Buffer.from(write.body).toString("utf8")) as Record<string, unknown>;
  const transportKeys = new Set([
    "worker_session_id", "worker_session_epoch", "lease_version", "fence_hash",
  ]);
  for (const [key, value] of Object.entries(body)) {
    if (!transportKeys.has(key)) assert.deepEqual(reauthorizedBody[key], value, `${key} must stay immutable`);
  }
  assert.equal(reauthorizedBody.worker_session_id, "worker:2");
  assert.equal(reauthorizedBody.worker_session_epoch, 2);
  assert.equal(reauthorizedBody.lease_version, 2);
  assert.equal(reauthorizedBody.fence_hash, HASH_B);
  const after = database.prepare(`select idempotency_key,kind,path,method,headers_json,
    cast(body_blob as text) as body,created_at,sent_at,response_hash from production_outbox
    where idempotency_key=?`).get(body.request_id) as Record<string, unknown>;
  assert.equal(after.created_at, before.created_at);
  assert.equal(typeof after.sent_at, "string");
  assert.equal(typeof after.response_hash, "string");
  const outboxCount = database.prepare("select count(*) as count from production_outbox").get() as {
    count: number;
  };
  assert.equal(Number(outboxCount.count), 1,
    "stale-fence recovery must update the original row only");
  const receipt = {
    request_id: write.idempotency_key,
    write_kind: "checkpoint" as const,
    payload_hash: hashCanonical(reauthorizedBody),
    response_json: response!,
  };
  assert.equal(store.recoverCheckpointPrefix({
    jobId: job.job_id,
    attemptId: job.grant.attempt_id,
    acceptedAttemptCount: 1,
    receipts: [receipt],
  }).checkpointSeq, 1);
  assert.equal(sendCount, 1);
}

async function assertRemoteReceiptReadback(store: ProductionRuntimeStore): Promise<void> {
  const readbackTask = task({
    jobId: "job:stale-fence-readback", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const readbackJob = claimTask(readbackTask);
  store.acceptTask(readbackTask, identityFor(readbackTask), readbackJob.grant.attempt_id);
  const readbackBody = recoveryCheckpointBody({
    jobId: readbackJob.job_id, attemptId: readbackJob.grant.attempt_id,
    requestId: "stale-fence-readback:accepted:1", checkpointSeq: 1, checkpointKind: "accepted",
  });
  const readbackPath = `/internal/ai-production/v6/jobs/${encodeURIComponent(readbackJob.job_id)}/checkpoints`;
  store.enqueue({
    idempotency_key: readbackBody.request_id, kind: "checkpoint", path: readbackPath, method: "POST",
    headers: { "x-ai-execution-fence-hash": HASH_A }, body: JSON.stringify(readbackBody),
  });
  await assert.rejects(store.deliverOutbox(readbackBody.request_id, async () => {
    throw runtimeTransportFailure("AI_LEASE_FENCE_STALE", 409);
  }), /AI_LEASE_FENCE_STALE/u);
  assert.equal(store.deferOutboxReconciliation(readbackJob.job_id, new Error("REMOTE_READ_FAILED")), 0,
    "generic reconciliation deferral must not wake a parked stale-fence intent");
  assert.equal(store.readOutboxAuthority(readbackBody.request_id)?.lastError,
    "WEBSITE_HTTP_409:AI_LEASE_FENCE_STALE");
  assert.equal(store.readOutboxAuthority(readbackBody.request_id)?.nextDeliveryAt, null);
  const readbackReceipt = checkpointReceipt(readbackBody, 1);
  let readbackSendCount = 0;
  const readbackDelivery = await store.deliverReauthorizedStaleCheckpoint({
    jobId: readbackJob.job_id,
    attemptId: readbackJob.grant.attempt_id,
    workerSessionId: "worker:2",
    workerSessionEpoch: 2,
    leaseVersion: 2,
    fenceHash: HASH_B,
    receipts: [readbackReceipt],
  }, async () => {
    readbackSendCount += 1;
    throw new Error("UNEXPECTED_STALE_FENCE_READBACK_SEND");
  });
  assert.deepEqual(readbackDelivery, { requestId: null, deliveryError: null },
    "an exact Website receipt must hydrate the old intent without a send");
  assert.equal(readbackSendCount, 0);
  assert.equal(store.readOutboxAuthority(readbackBody.request_id)?.state, "delivered");
  
}

async function assertLocalCodeCannotForgeRemoteProof(store: ProductionRuntimeStore): Promise<void> {
  const localErrorTask = task({
    jobId: "job:stale-fence-local-error", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const localErrorJob = claimTask(localErrorTask);
  store.acceptTask(localErrorTask, identityFor(localErrorTask), localErrorJob.grant.attempt_id);
  const localErrorBody = recoveryCheckpointBody({
    jobId: localErrorJob.job_id, attemptId: localErrorJob.grant.attempt_id,
    requestId: "stale-fence-local-error:accepted:1", checkpointSeq: 1, checkpointKind: "accepted",
  });
  store.enqueue({
    idempotency_key: localErrorBody.request_id, kind: "checkpoint",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(localErrorJob.job_id)}/checkpoints`,
    method: "POST", headers: { "x-ai-execution-fence-hash": HASH_A },
    body: JSON.stringify(localErrorBody),
  });
  await assert.rejects(store.deliverOutbox(localErrorBody.request_id, async () => {
    throw executionFailure("failed", "AI_LEASE_FENCE_STALE");
  }), /AI_LEASE_FENCE_STALE/u);
  assert.equal(store.readOutboxAuthority(localErrorBody.request_id)?.lastError,
    "AI_LEASE_FENCE_STALE", "a same-code local failure must not forge Website HTTP 409 proof");
  assert.ok(store.readOutboxAuthority(localErrorBody.request_id)?.nextDeliveryAt);
  let localErrorRecoverySends = 0;
  assert.deepEqual(await store.deliverReauthorizedStaleCheckpoint({
    jobId: localErrorJob.job_id,
    attemptId: localErrorJob.grant.attempt_id,
    workerSessionId: "worker:2",
    workerSessionEpoch: 2,
    leaseVersion: 2,
    fenceHash: HASH_B,
    receipts: [],
  }, async () => {
    localErrorRecoverySends += 1;
    return {};
  }), { requestId: null, deliveryError: null });
  assert.equal(localErrorRecoverySends, 0);
  
}

async function assertSerializedStaleFenceRace(store: ProductionRuntimeStore): Promise<void> {
  const raceTask = task({
    jobId: "job:stale-fence-tail-race", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const raceJob = claimTask(raceTask);
  store.acceptTask(raceTask, identityFor(raceTask), raceJob.grant.attempt_id);
  const raceBody = recoveryCheckpointBody({
    jobId: raceJob.job_id, attemptId: raceJob.grant.attempt_id,
    requestId: "stale-fence-tail-race:accepted:1", checkpointSeq: 1, checkpointKind: "accepted",
  });
  store.enqueue({
    idempotency_key: raceBody.request_id, kind: "checkpoint",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(raceJob.job_id)}/checkpoints`,
    method: "POST", headers: { "x-ai-execution-fence-hash": HASH_A }, body: JSON.stringify(raceBody),
  });
  const staleSnapshot = store.pendingOutbox().find(
    (candidate) => candidate.idempotency_key === raceBody.request_id,
  )!;
  let releaseFirst!: () => void;
  let firstStarted!: () => void;
  const firstStartedPromise = new Promise<void>((resolve) => { firstStarted = resolve; });
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const firstDelivery = store.deliverOutbox(raceBody.request_id, async () => {
    firstStarted();
    await firstGate;
    throw runtimeTransportFailure("AI_LEASE_FENCE_STALE", 409);
  });
  await firstStartedPromise;
  let staleSnapshotSendCount = 0;
  const queuedOldSnapshot = store.deliverOutbox(staleSnapshot.idempotency_key, async () => {
    staleSnapshotSendCount += 1;
    return { forbidden: true };
  });
  let recoveredFence: unknown = null;
  const recoveredDelivery = store.deliverReauthorizedStaleCheckpoint({
    jobId: raceJob.job_id,
    attemptId: raceJob.grant.attempt_id,
    workerSessionId: "worker:2",
    workerSessionEpoch: 2,
    leaseVersion: 2,
    fenceHash: HASH_B,
    receipts: [],
  }, async (fresh) => {
    recoveredFence = fresh.headers["x-ai-execution-fence-hash"];
    return { recovered: true };
  });
  releaseFirst();
  await assert.rejects(firstDelivery, /AI_LEASE_FENCE_STALE/u);
  await assert.rejects(queuedOldSnapshot, /PRODUCTION_STALE_FENCE_REAUTHORIZATION_REQUIRED/u);
  assert.equal((await recoveredDelivery).requestId, raceBody.request_id);
  assert.equal(recoveredFence, HASH_B);
  assert.equal(staleSnapshotSendCount, 0,
    "an old pendingOutbox snapshot must not cross the serialized reauthorization");
  
  const deliveryFailure = runtimeTransportFailure("AI_LEASE_FENCE_STALE", 409);
  const statusFailure = new Error("DEVICE_JOB_STATUS_UNAVAILABLE");
  assert.throws(
    () => throwStaleFenceReadbackFailure(deliveryFailure, statusFailure),
    (error: unknown) => error instanceof AggregateError
      && error.cause === deliveryFailure
      && error.errors[0] === deliveryFailure
      && error.errors[1] === statusFailure,
    "delivery and status failures must remain separately inspectable with delivery as the primary cause",
  );
  
}

async function assertAmbiguousStaleFenceFailsClosed(store: ProductionRuntimeStore): Promise<void> {
  const ambiguousTask = task({
    jobId: "job:stale-fence-ambiguous", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const ambiguousJob = claimTask(ambiguousTask);
  store.acceptTask(ambiguousTask, identityFor(ambiguousTask), ambiguousJob.grant.attempt_id);
  const ambiguousPath = `/internal/ai-production/v6/jobs/${encodeURIComponent(ambiguousJob.job_id)}/checkpoints`;
  for (const ambiguousBody of [
    recoveryCheckpointBody({
      jobId: ambiguousJob.job_id, attemptId: ambiguousJob.grant.attempt_id,
      requestId: "stale-fence-ambiguous:accepted:1", checkpointSeq: 1, checkpointKind: "accepted",
    }),
    recoveryCheckpointBody({
      jobId: ambiguousJob.job_id, attemptId: ambiguousJob.grant.attempt_id,
      requestId: "stale-fence-ambiguous:progress:2", checkpointSeq: 2, checkpointKind: "progress",
    }),
  ]) {
    store.enqueue({
      idempotency_key: ambiguousBody.request_id, kind: "checkpoint", path: ambiguousPath,
      method: "POST", headers: { "x-ai-execution-fence-hash": HASH_A },
      body: JSON.stringify(ambiguousBody),
    });
    await assert.rejects(store.deliverOutbox(ambiguousBody.request_id, async () => {
      throw runtimeTransportFailure("AI_LEASE_FENCE_STALE", 409);
    }), /AI_LEASE_FENCE_STALE/u);
  }
  await assert.rejects(store.deliverReauthorizedStaleCheckpoint({
    jobId: ambiguousJob.job_id,
    attemptId: ambiguousJob.grant.attempt_id,
    workerSessionId: "worker:2",
    workerSessionEpoch: 2,
    leaseVersion: 2,
    fenceHash: HASH_B,
    receipts: [],
  }, async () => {
    throw new Error("UNEXPECTED_AMBIGUOUS_STALE_FENCE_SEND");
  }), /PRODUCTION_STALE_FENCE_INTENT_AMBIGUOUS/u);
}

function assertPermanentRevocationRemainsParked(store: ProductionRuntimeStore): void {
  const revokedTask = task({
    jobId: "job:permanent-revocation-park", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const revokedJob = claimTask(revokedTask);
  store.acceptTask(revokedTask, identityFor(revokedTask), revokedJob.grant.attempt_id);
  const revokedBody = recoveryCheckpointBody({
    jobId: revokedJob.job_id, attemptId: revokedJob.grant.attempt_id,
    requestId: "permanent-revocation-park:accepted:1", checkpointSeq: 1, checkpointKind: "accepted",
  });
  store.enqueue({
    idempotency_key: revokedBody.request_id, kind: "checkpoint",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(revokedJob.job_id)}/checkpoints`,
    method: "POST", headers: { "x-ai-execution-fence-hash": HASH_A },
    body: JSON.stringify(revokedBody),
  });
  assert.equal(store.settlePermanentlyRevokedJob(
    revokedJob.job_id,
    "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED",
  ), 1);
  assert.equal(store.deferOutboxReconciliation(revokedJob.job_id, new Error("REMOTE_READ_FAILED")), 0);
  assert.equal(store.readOutboxAuthority(revokedBody.request_id)?.lastError,
    "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED");
  assert.equal(store.readOutboxAuthority(revokedBody.request_id)?.nextDeliveryAt, null);
}

export async function assertStaleFenceRecovery(): Promise<void> {
  const temporary = await mkdtemp(path.join(tmpdir(), "agent-production-stale-fence-"));
  const store = new ProductionRuntimeStore(temporary);
  try {
    const database = Reflect.get(store, "database") as Database.Database;
    const exact = await deliverExactStaleFence(store, database);
    assertExactStaleFence(store, database, exact);
    await assertRemoteReceiptReadback(store);
    await assertLocalCodeCannotForgeRemoteProof(store);
    await assertSerializedStaleFenceRace(store);
    await assertAmbiguousStaleFenceFailsClosed(store);
    assertPermanentRevocationRemainsParked(store);
  } finally {
    store.close();
    await rm(temporary, { recursive: true, force: true });
  }
}
