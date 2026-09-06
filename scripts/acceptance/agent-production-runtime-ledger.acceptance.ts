import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { resolveStoredProductionAuthority } from
  "../../src/lib/local-runtime/production/store-authority-reader.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { executionFailure, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { serializeTerminalFailure } from "../../src/lib/local-runtime/production/terminal-failure.js";
import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { HASH_A, HASH_B, identityFor, resultFor, task } from "./agent-production-runtime-fixtures.js";
import { verifyBrowserFailureStoreContract } from
  "./agent-production-runtime-browser-failure.acceptance-support.js";
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
  verifyBrowserFailureStoreContract(store);
  assert.throws(
    () => store.recordAttemptFailure(
      binaryTask.job_id,
      firstAttempt,
      serializeTerminalFailure(executionFailure("failed", "DIFFERENT_FAILURE")),
    ),
    /PRODUCTION_ATTEMPT_FAILURE_IMMUTABLE/u,
  );
  store.recordCheckpoint({
    jobId: binaryTask.job_id, attemptId: firstAttempt, checkpointId: "attempt_failure",
    checkpointHash: HASH_A, state: "persisted",
  });
  store.recordLease({
    jobId: binaryTask.job_id, attemptId: firstAttempt, leaseVersion: 1,
    fenceHash: HASH_A, state: "stale", expiresAt: null,
  });
  const secondAttempt = "attempt:binary:2";
  const second = store.acceptTask(binaryTask, identity, secondAttempt);
  assert.equal(second.current_attempt_id, secondAttempt);
  assert.equal(second.attempt_failure, null);
  assert.equal(second.current_reason, "LEASE_GRANTED");
  assert.equal(store.readCheckpoint(binaryTask.job_id), null,
    "a new attempt must retire the prior attempt's current checkpoint authority atomically");
  assert.equal(store.readLease(binaryTask.job_id), null,
    "a new attempt must retire the prior attempt's current lease authority atomically");
  assert.deepEqual(store.attemptIdsForTask(binaryTask.job_id), [firstAttempt, secondAttempt],
    "attempt rotation must preserve immutable prior failure history");
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
      throw runtimeTransportFailure("AI_V6_CHECKPOINT_SEQUENCE_INVALID", 409);
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
  const failedCheckpoint = store.recordCheckpoint({
    jobId: binaryTask.job_id, attemptId: thirdAttempt, checkpointId: "attempt_failure",
    checkpointHash: null, state: "failed",
  });
  assert.equal(resolveStoredProductionAuthority(
    dataDirectory, `production-checkpoint:${binaryTask.job_id}`, hashCanonical(failedCheckpoint),
  ), "verified", "a legal failed checkpoint must remain readable authority");
  const wildcardTask = task({ jobId: "job:a_b", productId: "bazi_ai_full_analysis", actionId: "produce" });
  const wildcardNeighbor = task({ jobId: "job:acb", productId: "bazi_ai_full_analysis", actionId: "produce" });
  for (const [candidate, key] of [[wildcardTask, "checkpoint:wildcard-target"],
    [wildcardNeighbor, "checkpoint:wildcard-neighbor"]] as const) {
    store.acceptTask(candidate, identityFor(candidate), `attempt:${candidate.job_id}`);
    store.enqueue({
      idempotency_key: key, kind: "checkpoint",
      path: `/internal/ai-production/v6/jobs/${encodeURIComponent(candidate.job_id)}/checkpoints`,
      method: "POST", headers: {}, body: "{}",
    });
  }
  assert.equal(store.settlePermanentlyRevokedJob(wildcardTask.job_id, "AUTHORIZATION_REVOKED"), 1,
    "permanent revocation must select one literal encoded job path, not a SQL LIKE wildcard");
  assert.equal(store.hasUnsentOutbox(wildcardTask.job_id), false);
  assert.equal(store.hasUnsentOutbox(wildcardNeighbor.job_id), true,
    "a similar job id must retain its independent pending Outbox intent");
  assert.equal(store.readOutboxAuthority("checkpoint:wildcard-neighbor")?.lastError, null);
  const outboxPath = `/internal/ai-production/v6/jobs/${encodeURIComponent(binaryTask.job_id)}/checkpoints`;
  const pendingBeforeDeterministic = store.pendingOutboxCount();
  store.enqueue({
    idempotency_key: "checkpoint:deterministic", kind: "checkpoint", path: outboxPath,
    method: "POST", headers: {}, body: "{}",
  });
  let deterministicCalls = 0;
  await assert.rejects(store.deliverOutbox("checkpoint:deterministic", async () => {
    deterministicCalls += 1;
    throw runtimeTransportFailure("REMOTE_CHECKPOINT_REJECTED", 409);
  }), /REMOTE_CHECKPOINT_REJECTED/u);
  assert.deepEqual(store.readOutboxAuthority("checkpoint:deterministic"), {
    idempotencyKey: "checkpoint:deterministic",
    jobId: binaryTask.job_id,
    kind: "checkpoint",
    state: "pending",
    nextDeliveryAt: store.readOutboxAuthority("checkpoint:deterministic")?.nextDeliveryAt,
    lastError: "REMOTE_CHECKPOINT_REJECTED",
    responseHash: null,
    receiptHash: null,
  });
  assert.ok(store.readOutboxAuthority("checkpoint:deterministic")?.nextDeliveryAt);
  await assert.rejects(
    store.deliverOutbox("checkpoint:deterministic", async () => { deterministicCalls += 1; return {}; }),
    /PRODUCTION_OUTBOX_DELIVERY_BACKOFF_ACTIVE/u,
  );
  assert.equal(deterministicCalls, 1, "deterministic rejection must preserve the same intent during bounded backoff");
  assert.equal(store.pendingOutboxCount(), pendingBeforeDeterministic + 1,
    "deterministic rejection remains pending delivery work");
  database.prepare("update production_outbox set next_delivery_at=? where idempotency_key=?")
    .run("2000-01-01T00:00:00.000Z", "checkpoint:deterministic");
  await store.deliverOutbox("checkpoint:deterministic", async () => {
    deterministicCalls += 1;
    return { checkpoint_hash: HASH_A };
  });
  assert.equal(deterministicCalls, 2, "the same deterministic intent must resume after finite backoff");
  assert.equal(store.readOutboxAuthority("checkpoint:deterministic")?.state, "delivered");
  assert.equal(store.pendingOutboxCount(), pendingBeforeDeterministic);
  store.enqueue({
    idempotency_key: "checkpoint:network-unknown", kind: "checkpoint", path: outboxPath,
    method: "POST", headers: {}, body: '{"network":true}',
  });
  await assert.rejects(store.deliverOutbox("checkpoint:network-unknown", async () => {
    throw executionFailure("failed", "CLOUD_TRANSPORT_UNAVAILABLE");
  }), /CLOUD_TRANSPORT_UNAVAILABLE/u);
  assert.equal(store.readOutboxAuthority("checkpoint:network-unknown")?.state, "pending");
  assert.ok(store.readOutboxAuthority("checkpoint:network-unknown")?.nextDeliveryAt);
  store.enqueue({
    idempotency_key: "checkpoint:server-error", kind: "checkpoint", path: outboxPath,
    method: "POST", headers: {}, body: '{"server":true}',
  });
  await assert.rejects(store.deliverOutbox("checkpoint:server-error", async () => {
    throw runtimeTransportFailure("REMOTE_TEMPORARILY_UNAVAILABLE", 503);
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
  const taskAuthority = store.readTask(binaryTask.job_id)!;
  assert.equal(resolveStoredProductionAuthority(
    dataDirectory, `production-task:${binaryTask.job_id}`, hashCanonical(taskAuthority),
  ), "verified");
  assert.equal(resolveStoredProductionAuthority(
    dataDirectory, `production-task:${binaryTask.job_id}`, HASH_A,
  ), "mismatch");
  assert.equal(resolveStoredProductionAuthority(
    dataDirectory, "production-task:job:not-present", HASH_A,
  ), "missing");
  store.enqueue({
    idempotency_key: "checkpoint:legacy-null-schedule", kind: "checkpoint", path: outboxPath,
    method: "POST", headers: {}, body: '{"legacy":true}',
  });
  database.prepare(`update production_outbox set last_error=?,next_delivery_at=null
    where idempotency_key=?`).run("REMOTE_CHECKPOINT_REJECTED", "checkpoint:legacy-null-schedule");
  store.close();
  assert.throws(
    () => new ProductionRuntimeStore(dataDirectory),
    /PRODUCTION_DATA_MIGRATION_REQUIRED/u,
    "ordinary startup must reject legacy data instead of silently rewriting it",
  );
  const unchangedData = new Database(path.join(dataDirectory, "production-runtime.sqlite"), { readonly: true });
  assert.equal((unchangedData.prepare(`select next_delivery_at from production_outbox
    where idempotency_key=?`).get("checkpoint:legacy-null-schedule") as { next_delivery_at: string | null })
    .next_delivery_at, null, "schema validation must not repair historical data");
  unchangedData.close();
  const emptyLegacyDirectory = path.join(temporary, "empty-legacy");
  await mkdir(emptyLegacyDirectory);
  const emptyLegacy = new Database(path.join(emptyLegacyDirectory, "production-runtime.sqlite"));
  emptyLegacy.exec("create table production_tasks(job_id text primary key,status text not null,failure_reason text)");
  emptyLegacy.close();
  assert.throws(
    () => new ProductionRuntimeStore(emptyLegacyDirectory),
    /PRODUCTION_SCHEMA_MIGRATION_REQUIRED/u,
    "even an empty legacy schema requires an explicit maintenance migration",
  );
  const unchangedLegacy = new Database(path.join(emptyLegacyDirectory, "production-runtime.sqlite"), { readonly: true });
  assert.equal(columns(unchangedLegacy, "production_tasks").includes("failure_reason"), true);
  assert.equal(columns(unchangedLegacy, "production_tasks").includes("current_reason"), false);
  unchangedLegacy.close();
  const tempOnlyLegacyDirectory = path.join(temporary, "temp-only-legacy");
  await mkdir(tempOnlyLegacyDirectory);
  const tempOnlyLegacy = new Database(path.join(tempOnlyLegacyDirectory, "production-runtime.sqlite"));
  tempOnlyLegacy.exec("create table production_continuations_v2_migration(continuation_ref text primary key)");
  tempOnlyLegacy.close();
  assert.throws(
    () => new ProductionRuntimeStore(tempOnlyLegacyDirectory),
    /PRODUCTION_SCHEMA_MIGRATION_REQUIRED/u,
    "a leftover migration table must never be mistaken for a new database",
  );
  const nonemptyLegacyDirectory = path.join(temporary, "nonempty-legacy");
  await mkdir(nonemptyLegacyDirectory);
  const nonemptyLegacy = new Database(path.join(nonemptyLegacyDirectory, "production-runtime.sqlite"));
  nonemptyLegacy.exec("create table production_tasks(job_id text primary key,status text not null,failure_reason text)");
  nonemptyLegacy.prepare("insert into production_tasks(job_id,status,failure_reason) values(?,?,?)")
    .run("job:must-be-cleared", "recovery_pending", "legacy");
  nonemptyLegacy.close();
  assert.throws(() => new ProductionRuntimeStore(nonemptyLegacyDirectory), /PRODUCTION_SCHEMA_MIGRATION_REQUIRED/u);
  const extraIndexDirectory = path.join(temporary, "extra-index");
  await mkdir(extraIndexDirectory);
  new ProductionRuntimeStore(extraIndexDirectory).close();
  const extraIndex = new Database(path.join(extraIndexDirectory, "production-runtime.sqlite"));
  extraIndex.exec("create index unauthorized_runtime_index on production_tasks(updated_at)");
  extraIndex.close();
  assert.throws(() => new ProductionRuntimeStore(extraIndexDirectory), /PRODUCTION_SCHEMA_MIGRATION_REQUIRED/u,
    "an additional index must fail exact schema readback");
  const missingAuthorityDirectory = path.join(temporary, "missing-authority");
  await mkdir(missingAuthorityDirectory);
  assert.throws(
    () => resolveStoredProductionAuthority(missingAuthorityDirectory, "production-task:job:1", HASH_A),
    (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_AUTHORITY_STORE_MISSING",
  );
  const unreadableAuthorityDirectory = path.join(temporary, "unreadable-authority");
  await mkdir(path.join(unreadableAuthorityDirectory, "production-runtime.sqlite"), { recursive: true });
  assert.throws(
    () => resolveStoredProductionAuthority(unreadableAuthorityDirectory, "production-task:job:1", HASH_A),
    (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_AUTHORITY_STORE_UNREADABLE",
  );
  const corruptAuthorityDirectory = path.join(temporary, "corrupt-authority");
  await mkdir(corruptAuthorityDirectory);
  const corruptAuthorityPath = path.join(corruptAuthorityDirectory, "production-runtime.sqlite");
  const corruptAuthority = new Database(corruptAuthorityPath);
  corruptAuthority.exec("create table unrelated(value text)");
  corruptAuthority.close();
  assert.throws(
    () => resolveStoredProductionAuthority(corruptAuthorityDirectory, "production-task:job:1", HASH_A),
    (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_AUTHORITY_STORE_CORRUPT",
  );
  const malformedDatabaseDirectory = path.join(temporary, "malformed-database");
  await mkdir(malformedDatabaseDirectory);
  await writeFile(path.join(malformedDatabaseDirectory, "production-runtime.sqlite"), "not-a-sqlite-database");
  assert.throws(
    () => new ProductionRuntimeStore(malformedDatabaseDirectory),
    (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_SCHEMA_CORRUPT",
  );
  const malformedOutboxDirectory = path.join(temporary, "malformed-outbox");
  await mkdir(malformedOutboxDirectory);
  const malformedOutboxStore = new ProductionRuntimeStore(malformedOutboxDirectory);
  const malformedTask = task({ jobId: "job:malformed-outbox", productId: "bazi_ai_full_analysis", actionId: "produce" });
  malformedOutboxStore.acceptTask(malformedTask, identityFor(malformedTask), "attempt:malformed-outbox");
  malformedOutboxStore.enqueue({
    idempotency_key: "outbox:malformed", kind: "checkpoint",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(malformedTask.job_id)}/checkpoints`,
    method: "POST", headers: {}, body: "{}",
  });
  malformedOutboxStore.close();
  const malformedOutboxDatabase = new Database(path.join(malformedOutboxDirectory, "production-runtime.sqlite"));
  malformedOutboxDatabase.prepare("update production_outbox set kind='bogus',method='DELETE',path='/broken'").run();
  malformedOutboxDatabase.close();
  const malformedOutboxReopened = new ProductionRuntimeStore(malformedOutboxDirectory);
  assert.throws(() => malformedOutboxReopened.assertStartupDataIntegrity(), /PRODUCTION_RUNTIME_DATA_CORRUPT/u);
  malformedOutboxReopened.close();
  assert.throws(
    () => resolveStoredProductionAuthority(malformedOutboxDirectory, "production-outbox:outbox:malformed", HASH_A),
    (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_AUTHORITY_STORE_CORRUPT",
  );
  const rowIdentityDirectory = path.join(temporary, "row-identity");
  await mkdir(rowIdentityDirectory);
  const rowIdentityStore = new ProductionRuntimeStore(rowIdentityDirectory);
  const rowIdentityTask = task({ jobId: "job:row-identity", productId: "bazi_ai_full_analysis", actionId: "produce" });
  rowIdentityStore.acceptTask(rowIdentityTask, identityFor(rowIdentityTask), "attempt:row-identity");
  rowIdentityStore.recordLease({ jobId: rowIdentityTask.job_id, attemptId: "attempt:row-identity",
    leaseVersion: 1, fenceHash: HASH_A, state: "active", expiresAt: "2026-09-03T12:00:00.000Z" });
  rowIdentityStore.close();
  const rowIdentityDatabase = new Database(path.join(rowIdentityDirectory, "production-runtime.sqlite"));
  rowIdentityDatabase.prepare("update production_leases set lease_version=0").run();
  rowIdentityDatabase.close();
  assert.throws(() => resolveStoredProductionAuthority(
    rowIdentityDirectory, `production-lease:${rowIdentityTask.job_id}`, HASH_A,
  ), (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_AUTHORITY_STORE_CORRUPT");
  const taskIdentityDatabase = new Database(path.join(rowIdentityDirectory, "production-runtime.sqlite"));
  taskIdentityDatabase.prepare("update production_leases set lease_version=1").run();
  taskIdentityDatabase.prepare("update production_tasks set request_hash=?").run(HASH_B);
  taskIdentityDatabase.close();
  assert.throws(() => new ProductionRuntimeStore(rowIdentityDirectory), /PRODUCTION_DATA_CORRUPT/u);
  assert.throws(() => resolveStoredProductionAuthority(
    rowIdentityDirectory, `production-task:${rowIdentityTask.job_id}`, HASH_A,
  ), (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_AUTHORITY_STORE_CORRUPT");
  const invariantDirectory = path.join(temporary, "checkpoint-lease-invariants");
  await mkdir(invariantDirectory);
  const invariantStore = new ProductionRuntimeStore(invariantDirectory);
  const invariantTask = task({ jobId: "job:checkpoint-lease-invariants",
    productId: "bazi_ai_full_analysis", actionId: "produce" });
  invariantStore.acceptTask(invariantTask, identityFor(invariantTask), "attempt:current");
  invariantStore.recordCheckpoint({
    jobId: invariantTask.job_id, attemptId: "attempt:current", checkpointId: "attempt_failure",
    checkpointHash: null, state: "failed",
  });
  invariantStore.recordLease({
    jobId: invariantTask.job_id, attemptId: "attempt:current", leaseVersion: 1,
    fenceHash: HASH_A, state: "absent", expiresAt: null,
  });
  const invariantDatabase = Reflect.get(invariantStore, "database") as Database.Database;
  invariantDatabase.prepare(`update production_checkpoints
    set checkpoint_id=null,checkpoint_hash=? where job_id=?`).run(HASH_A, invariantTask.job_id);
  invariantDatabase.prepare(`update production_leases
    set attempt_id='attempt:wrong',expires_at=? where job_id=?`
  ).run("2026-09-03T12:00:00.000Z", invariantTask.job_id);
  assert.throws(() => invariantStore.readCheckpoint(invariantTask.job_id), /PRODUCTION_AUTHORITY_ROW_CORRUPT/u);
  assert.throws(() => invariantStore.readLease(invariantTask.job_id), /PRODUCTION_AUTHORITY_ROW_CORRUPT/u);
  assert.throws(() => invariantStore.assertStartupDataIntegrity(), /PRODUCTION_RUNTIME_DATA_CORRUPT/u,
    "live startup integrity must reject invalid state shape and wrong-attempt authority");
  invariantStore.close();
  assert.throws(() => new ProductionRuntimeStore(invariantDirectory), /PRODUCTION_DATA_CORRUPT/u,
    "ordinary store startup must reject the same invalid checkpoint and lease rows");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
for (const evidenceMode of ["exam.golden", "exam.property", "exam.state-machine"] as const) {
  emitQualityProofObservation({
    lawId: "LAW-AGENT-PRODUCTION-RUNTIME-005-V11",
    evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "summary"],
    locator: `acceptance:agent-production-runtime:sqlite-authority:${evidenceMode}`,
    observedValue: "six-table SQLite authority exact schema and data drift failed closed without automatic migration while verified missing mismatch and corrupt authority states remained distinct",
  });
}
