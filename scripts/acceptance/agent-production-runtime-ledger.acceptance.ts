import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { executionFailure, serializeTerminalFailure } from "../../src/lib/typed-failure.js";
import { HASH_A, identityFor, resultFor, task } from "./agent-production-runtime-fixtures.js";

const temporary = await mkdtemp(path.join(tmpdir(), "agent-production-ledger-"));
const columns = (database: Database.Database, table: string): string[] =>
  (database.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name);

const recoveryCheckpointBody = (input: Readonly<{
  jobId: string;
  attemptId: string;
  requestId: string;
  checkpointSeq: number;
  checkpointKind: "accepted" | "progress" | "attempt_failure";
  attemptFailure?: unknown;
}>) => ({
  schema_version: "xuanxue-ai-checkpoint.v6",
  control_protocol_version: "xuanxue-ai-production-v6",
  request_id: input.requestId,
  idempotency_key: input.requestId,
  job_id: input.jobId,
  worker_session_id: "session:recovery",
  worker_session_epoch: 1,
  attempt_id: input.attemptId,
  lease_version: 2,
  fence_hash: HASH_A,
  local_order_id: input.jobId,
  checkpoint_seq: input.checkpointSeq,
  checkpoint_kind: input.checkpointKind,
  payload_hash: hashCanonical({
    job_id: input.jobId,
    attempt_id: input.attemptId,
    checkpoint_seq: input.checkpointSeq,
    checkpoint_kind: input.checkpointKind,
  }),
  object_receipts: [],
  attempt_failure: input.attemptFailure ?? null,
});

try {
  const dataDirectory = path.join(temporary, "binary-store");
  await mkdir(dataDirectory);
  let store = new ProductionRuntimeStore(dataDirectory);
  const database = Reflect.get(store, "database") as Database.Database;
  assert.deepEqual(
    columns(database, "production_tasks").filter((name) => [
      "status", "current_attempt_id", "current_reason", "result_json", "staged_result_json",
    ].includes(name)),
    ["status", "result_json", "staged_result_json", "current_attempt_id", "current_reason"],
  );
  assert.equal(columns(database, "production_tasks").includes("failure_reason"), false);
  assert.equal(columns(database, "production_outbox").includes("delivery_build_hash"), false);
  assert.equal(columns(database, "production_outbox").includes("delivery_attempt_count"), false);
  assert.equal(columns(database, "production_outbox").includes("delivery_parked_at"), false);
  assert.deepEqual(
    columns(database, "production_outbox").filter((name) => ["last_error", "next_delivery_at"].includes(name)),
    ["last_error", "next_delivery_at"],
  );
  assert.deepEqual(columns(database, "production_attempt_failures"), [
    "job_id", "attempt_id", "failure_json", "created_at",
  ]);

  const binaryTask = task({
    jobId: "job:binary", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const identity = identityFor(binaryTask);
  const firstAttempt = "attempt:binary:1";
  assert.deepEqual(
    { status: store.acceptTask(binaryTask, identity, firstAttempt).status,
      reason: store.readTask(binaryTask.job_id)?.current_reason },
    { status: "failed", reason: "LEASE_GRANTED" },
  );
  store.markExecuting(binaryTask.job_id);
  assert.deepEqual(
    { status: store.readTask(binaryTask.job_id)?.status, reason: store.readTask(binaryTask.job_id)?.current_reason },
    { status: "failed", reason: "EXECUTING" },
  );
  const firstFailure = serializeTerminalFailure(executionFailure("failed", "PROVIDER_REJECTED"));
  store.recordAttemptFailure(binaryTask.job_id, firstAttempt, firstFailure);
  store.recordAttemptFailure(binaryTask.job_id, firstAttempt, firstFailure);
  assert.deepEqual(store.readTask(binaryTask.job_id)?.attempt_failure, firstFailure);
  assert.throws(
    () => store.recordAttemptFailure(
      binaryTask.job_id,
      firstAttempt,
      serializeTerminalFailure(executionFailure("failed", "DIFFERENT_FAILURE")),
    ),
    /PRODUCTION_ATTEMPT_FAILURE_IMMUTABLE/u,
  );
  const secondAttempt = "attempt:binary:2";
  const second = store.acceptTask(binaryTask, identity, secondAttempt);
  assert.equal(second.current_attempt_id, secondAttempt);
  assert.equal(second.attempt_failure, null);
  assert.equal(second.current_reason, "LEASE_GRANTED");
  assert.throws(
    () => store.acceptTask(binaryTask, { ...identity, plugin_version: identity.plugin_version + 1 }, secondAttempt),
    /PRODUCTION_TASK_IDENTITY_CONFLICT/u,
  );

  const falseCheckpointFailure = serializeTerminalFailure(executionFailure(
    "failed", "AI_V6_CHECKPOINT_SEQUENCE_INVALID", { cause: new Error("sequence") },
  ));
  store.recordAttemptFailure(binaryTask.job_id, secondAttempt, falseCheckpointFailure);
  const recoveryPath = `/internal/ai-production/v6/jobs/${encodeURIComponent(binaryTask.job_id)}/checkpoints`;
  const remoteReceipts = [
    recoveryCheckpointBody({
      jobId: binaryTask.job_id, attemptId: secondAttempt,
      requestId: "checkpoint:recovery-accepted", checkpointSeq: 1, checkpointKind: "accepted",
    }),
    recoveryCheckpointBody({
      jobId: binaryTask.job_id, attemptId: secondAttempt,
      requestId: "checkpoint:recovery-progress", checkpointSeq: 2, checkpointKind: "progress",
    }),
  ].map((body) => {
    const response = {
      job_id: binaryTask.job_id,
      checkpoint_seq: body.checkpoint_seq,
      checkpoint_hash: hashCanonical(body),
      accepted_at: "2026-08-29T20:19:07.000Z",
      accepted_attempt_count: 2,
      status: "failed",
    };
    store.enqueue({
      idempotency_key: body.request_id, kind: "checkpoint", path: recoveryPath,
      method: "POST", headers: {}, body: JSON.stringify(body),
    });
    store.markOutboxSent(body.request_id, response);
    return {
      request_id: body.request_id,
      write_kind: "checkpoint",
      payload_hash: hashCanonical(body),
      response_json: response,
    } as const;
  });
  for (const body of [
    recoveryCheckpointBody({
      jobId: binaryTask.job_id, attemptId: secondAttempt,
      requestId: "checkpoint:rejected-accepted", checkpointSeq: 1, checkpointKind: "accepted",
    }),
    recoveryCheckpointBody({
      jobId: binaryTask.job_id, attemptId: secondAttempt,
      requestId: "checkpoint:rejected-failure", checkpointSeq: 2,
      checkpointKind: "attempt_failure", attemptFailure: falseCheckpointFailure,
    }),
  ]) {
    store.enqueue({
      idempotency_key: body.request_id, kind: "checkpoint", path: recoveryPath,
      method: "POST", headers: {}, body: JSON.stringify(body),
    });
    await assert.rejects(store.deliverOutbox(body.request_id, async () => {
      throw executionFailure("failed", "AI_V6_CHECKPOINT_SEQUENCE_INVALID", { httpStatus: 409 });
    }), /AI_V6_CHECKPOINT_SEQUENCE_INVALID/u);
  }
  const failureRowsBefore = Number((database.prepare(`select count(*) as count
    from production_attempt_failures where job_id=? and attempt_id=?`
  ).get(binaryTask.job_id, secondAttempt) as { count: number }).count);
  assert.equal(failureRowsBefore, 1);
  const recoveredPrefix = store.recoverCheckpointPrefix({
    jobId: binaryTask.job_id,
    attemptId: secondAttempt,
    acceptedAttemptCount: 2,
    receipts: remoteReceipts,
  });
  assert.equal(recoveredPrefix.checkpointSeq, 2);
  assert.equal(recoveredPrefix.checkpointHash, remoteReceipts[1]!.payload_hash);
  assert.equal(store.readTask(binaryTask.job_id)?.attempt_failure, null);
  assert.equal(Number((database.prepare(`select count(*) as count from production_attempt_failures
    where job_id=? and attempt_id=?`).get(binaryTask.job_id, secondAttempt) as { count: number }).count),
  0, "the exact locally misrecorded failure must be physically removed after receipt proof");
  assert.deepEqual(store.recoverCheckpointPrefix({
    jobId: binaryTask.job_id, attemptId: secondAttempt,
    acceptedAttemptCount: 2, receipts: remoteReceipts,
  }), recoveredPrefix, "reconciliation is idempotent from the same receipts and Outbox rows");
  const realFailure = serializeTerminalFailure(executionFailure("failed", "BROWSER_POSTCONDITION_FAILED"));
  store.recordAttemptFailure(binaryTask.job_id, secondAttempt, realFailure);
  assert.deepEqual(store.readTask(binaryTask.job_id)?.attempt_failure, realFailure);
  assert.throws(() => store.recoverCheckpointPrefix({
    jobId: binaryTask.job_id, attemptId: secondAttempt,
    acceptedAttemptCount: 2, receipts: remoteReceipts,
  }), /PRODUCTION_RECOVERY_FAILURE_SHAPE_MISMATCH/u,
  "a genuine Product failure must never be removed by checkpoint recovery");
  assert.equal(Number((database.prepare(`select count(*) as count from production_attempt_failures
    where job_id=? and attempt_id=?`).get(binaryTask.job_id, secondAttempt) as { count: number }).count), 1);
  const thirdAttempt = "attempt:binary:3";
  assert.equal(store.acceptTask(binaryTask, identity, thirdAttempt).attempt_failure, null);

  const outboxPath = `/internal/ai-production/v6/jobs/${encodeURIComponent(binaryTask.job_id)}/checkpoints`;
  store.enqueue({
    idempotency_key: "checkpoint:deterministic", kind: "checkpoint", path: outboxPath,
    method: "POST", headers: {}, body: "{}",
  });
  let deterministicCalls = 0;
  await assert.rejects(store.deliverOutbox("checkpoint:deterministic", async () => {
    deterministicCalls += 1;
    throw executionFailure("failed", "REMOTE_CHECKPOINT_REJECTED", { httpStatus: 409 });
  }), /REMOTE_CHECKPOINT_REJECTED/u);
  assert.deepEqual(store.readOutboxAuthority("checkpoint:deterministic"), {
    idempotencyKey: "checkpoint:deterministic",
    jobId: binaryTask.job_id,
    kind: "checkpoint",
    state: "failed",
    nextDeliveryAt: null,
    lastError: "REMOTE_CHECKPOINT_REJECTED",
    responseHash: null,
    receiptHash: null,
  });
  await assert.rejects(
    store.deliverOutbox("checkpoint:deterministic", async () => { deterministicCalls += 1; return {}; }),
    /REMOTE_CHECKPOINT_REJECTED/u,
  );
  assert.equal(deterministicCalls, 1, "deterministic rejection must stop the same intent without a local budget");
  assert.equal(store.pendingOutboxCount(), 0, "deterministic rejected rows are diagnostic, not pending work");

  store.enqueue({
    idempotency_key: "checkpoint:network-unknown", kind: "checkpoint", path: outboxPath,
    method: "POST", headers: {}, body: '{"network":true}',
  });
  await assert.rejects(store.deliverOutbox("checkpoint:network-unknown", async () => {
    throw executionFailure("failed", "CLOUD_TRANSPORT_UNAVAILABLE");
  }), /CLOUD_TRANSPORT_UNAVAILABLE/u);
  assert.equal(store.readOutboxAuthority("checkpoint:network-unknown")?.state, "failed");
  assert.equal(store.readOutboxAuthority("checkpoint:network-unknown")?.nextDeliveryAt, null);
  store.hydrateRemoteOutboxReceipts(binaryTask.job_id, []);
  assert.equal(store.readOutboxAuthority("checkpoint:network-unknown")?.state, "pending");
  assert.ok(store.readOutboxAuthority("checkpoint:network-unknown")?.nextDeliveryAt);

  store.enqueue({
    idempotency_key: "checkpoint:server-error", kind: "checkpoint", path: outboxPath,
    method: "POST", headers: {}, body: '{"server":true}',
  });
  await assert.rejects(store.deliverOutbox("checkpoint:server-error", async () => {
    throw executionFailure("failed", "REMOTE_TEMPORARILY_UNAVAILABLE", { httpStatus: 503 });
  }), /REMOTE_TEMPORARILY_UNAVAILABLE/u);
  assert.equal(store.readOutboxAuthority("checkpoint:server-error")?.state, "pending");
  assert.ok(store.readOutboxAuthority("checkpoint:server-error")?.nextDeliveryAt);
  database.prepare("update production_outbox set next_delivery_at=? where idempotency_key=?")
    .run("2000-01-01T00:00:00.000Z", "checkpoint:server-error");
  await store.deliverOutbox("checkpoint:server-error", async () => ({ checkpoint_hash: HASH_A }));
  assert.equal(store.readOutboxAuthority("checkpoint:server-error")?.state, "delivered");

  store.enqueue({
    idempotency_key: "checkpoint:remote-receipt", kind: "checkpoint", path: outboxPath,
    method: "POST", headers: {}, body: '{"receipt":true}',
  });
  const receiptBody = { checkpoint_hash: HASH_A };
  assert.equal(store.hydrateRemoteOutboxReceipts(binaryTask.job_id, [{
    request_id: "checkpoint:remote-receipt",
    write_kind: "checkpoint",
    payload_hash: hashCanonical({ receipt: true }),
    response_json: receiptBody,
  }]), 1);
  assert.deepEqual(store.readOutboxResponse("checkpoint:remote-receipt"), receiptBody);

  assert.equal(store.isLedgerConsistent(new Set()), true,
    "a failed Outbox belongs to its job and must not become a global claim verdict");
  const result = resultFor(binaryTask, identity);
  store.stageResult(binaryTask.job_id, result);
  assert.deepEqual(
    { status: store.readTask(binaryTask.job_id)?.status, reason: store.readTask(binaryTask.job_id)?.current_reason },
    { status: "failed", reason: "BUSINESS_ADMISSION_PENDING" },
  );
  store.completeTask(binaryTask.job_id, result);
  assert.deepEqual(
    { status: store.readTask(binaryTask.job_id)?.status, reason: store.readTask(binaryTask.job_id)?.current_reason },
    { status: "completed", reason: null },
  );
  store.close();

  store = new ProductionRuntimeStore(dataDirectory);
  assert.equal(store.readTask(binaryTask.job_id)?.status, "completed");
  assert.equal(columns(Reflect.get(store, "database") as Database.Database, "production_outbox").includes("delivery_parked_at"), false);
  store.close();

  const emptyLegacyDirectory = path.join(temporary, "empty-legacy");
  await mkdir(emptyLegacyDirectory);
  const emptyLegacy = new Database(path.join(emptyLegacyDirectory, "production-runtime.sqlite"));
  emptyLegacy.exec("create table production_tasks(job_id text primary key,status text not null,failure_reason text)");
  emptyLegacy.close();
  const cutover = new ProductionRuntimeStore(emptyLegacyDirectory);
  const cutoverDatabase = Reflect.get(cutover, "database") as Database.Database;
  assert.equal(columns(cutoverDatabase, "production_tasks").includes("current_reason"), true);
  assert.equal(columns(cutoverDatabase, "production_tasks").includes("failure_reason"), false);
  cutover.close();

  const nonemptyLegacyDirectory = path.join(temporary, "nonempty-legacy");
  await mkdir(nonemptyLegacyDirectory);
  const nonemptyLegacy = new Database(path.join(nonemptyLegacyDirectory, "production-runtime.sqlite"));
  nonemptyLegacy.exec("create table production_tasks(job_id text primary key,status text not null,failure_reason text)");
  nonemptyLegacy.prepare("insert into production_tasks(job_id,status,failure_reason) values(?,?,?)")
    .run("job:must-be-cleared", "recovery_pending", "legacy");
  nonemptyLegacy.close();
  assert.throws(() => new ProductionRuntimeStore(nonemptyLegacyDirectory), /PRODUCTION_EMPTY_CUTOVER_REQUIRED/u);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
