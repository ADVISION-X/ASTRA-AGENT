import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { uploadProductionResult } from "../../src/lib/local-runtime/production/cloud-client.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { executionFailure } from "../../src/lib/typed-failure.js";
import { claimTask, HASH_A, HASH_B, HASH_C, identityFor, resultFor, task, terminalReceipt } from "./agent-production-runtime-fixtures.js";

const temporary = await mkdtemp(path.join(tmpdir(), "agent-production-ledger-"));
try {
  const ledgerDirectory = path.join(temporary, "ledger-mutants");
  await mkdir(ledgerDirectory);
  const ledgerStore = new ProductionRuntimeStore(ledgerDirectory);
  assert.equal(ledgerStore.isLedgerConsistent(new Set()), true);
  ledgerStore.enqueue({
    idempotency_key: "ledger:artifact", kind: "artifact",
    path: "/internal/ai-production/v6/jobs/job%3Aledger/artifacts/result_payload",
    method: "PUT", headers: {}, body: "{}",
  });
  assert.equal(ledgerStore.isLedgerConsistent(new Set()), false);
  ledgerStore.markOutboxSent("ledger:artifact", { object_ref: "object:without-receipt" });
  assert.equal(ledgerStore.isLedgerConsistent(new Set()), false);
  ledgerStore.close();

  const reconciliationDirectory = path.join(temporary, "reconciliation-mutants");
  await mkdir(reconciliationDirectory);
  const store = new ProductionRuntimeStore(reconciliationDirectory);
  const imageBaseTask = task({
    jobId: "job:generated-image-cleanup", productId: "public_knowledge_article_pipeline", actionId: "produce_article",
  });
  const imageTask = claimTask(imageBaseTask);
  const imageDirectory = path.join(temporary, "generated-images", "upload-failure-mutant");
  const originalLocalPath = path.join(imageDirectory, `${HASH_A.slice("sha256:".length)}.original`);
  const localPath = path.join(imageDirectory, `${HASH_B.slice("sha256:".length)}.webp`);
  await mkdir(imageDirectory, { recursive: true });
  await writeFile(originalLocalPath, "raw-image", { mode: 0o600 });
  await writeFile(localPath, "invalid-webp", { mode: 0o600 });
  await assert.rejects(uploadProductionResult({
    session: {} as never, store, job: imageTask, identity: identityFor(imageBaseTask),
    output: {
      payload: {}, evidence_refs: ["rec-proof"],
      generated_image: {
        artifact_id: "artifact:image-cleanup", local_path: localPath, original_local_path: originalLocalPath,
        sha256: HASH_B, original_sha256: HASH_A, bytes: Buffer.byteLength("invalid-webp"),
        media_type: "image/webp", width: 1200, height: 630,
      },
    },
    continuationRef: null, dataDir: temporary,
  }), /GENERATED_IMAGE_LOCAL_IDENTITY_MISMATCH/u);
  await assert.rejects(access(imageDirectory), { code: "ENOENT" });

  const staleTask = task({ jobId: "job:stale-ledger", productId: "payment_screenshot_observation", actionId: "observe" });
  store.acceptTask(staleTask, identityFor(staleTask));
  store.recordCheckpoint({
    jobId: staleTask.job_id, attemptId: "attempt:stale", checkpointId: "accepted",
    checkpointHash: HASH_A, state: "persisted",
  });
  store.recordLease({
    jobId: staleTask.job_id, attemptId: "attempt:stale", leaseVersion: 1,
    fenceHash: HASH_B, state: "active", expiresAt: "2030-01-01T00:05:00.000Z",
  });
  assert.equal(store.isLedgerConsistent(new Set([staleTask.job_id])), true);
  store.recordLease({
    jobId: staleTask.job_id, attemptId: "attempt:stale", leaseVersion: 1,
    fenceHash: HASH_B, state: "stale", expiresAt: "2026-08-27T00:00:00.000Z",
  });
  assert.equal(store.isLedgerConsistent(new Set([staleTask.job_id])), false);
  store.setRecoveryPending(staleTask.job_id, "AGENT_PROCESS_RESTARTED");
  assert.equal(store.isLedgerConsistent(new Set()), true);

  const deliveredTask = task({
    jobId: "job:delivered-terminal", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const deliveredIdentity = identityFor(deliveredTask);
  const deliveredResult = resultFor(deliveredTask, deliveredIdentity);
  store.acceptTask(deliveredTask, deliveredIdentity);
  store.stageResult(deliveredTask.job_id, deliveredResult);
  store.enqueue({
    idempotency_key: "terminal:delivered", kind: "terminal",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(deliveredTask.job_id)}/terminal`,
    method: "POST", headers: {},
    body: JSON.stringify({
      schema_version: "xuanxue-ai-terminal-cas.v6", job_id: deliveredTask.job_id,
      terminal_status: "completed", failure: null, payload_hash: hashCanonical(deliveredResult),
      worker_session_id: "worker:receipt", worker_session_epoch: 1,
    }),
  });
  const completedReceipt = terminalReceipt({
    jobId: deliveredTask.job_id, payloadHash: hashCanonical(deliveredResult),
  });
  assert.throws(() => store.markOutboxSent("terminal:delivered", { terminal_status: "completed" }),
    /V6_TERMINAL_RECEIPT_INVALID/u);
  assert.equal(store.readOutboxAuthority("terminal:delivered")?.state, "pending");
  assert.throws(() => store.markOutboxSent("terminal:delivered", {
    ...completedReceipt, job_id: "job:wrong-receipt-owner",
  }), /V6_TERMINAL_RECEIPT_MISMATCH/u);
  assert.throws(() => store.markOutboxSent("terminal:delivered", {
    ...completedReceipt, payload_hash: HASH_C,
  }), /V6_TERMINAL_RECEIPT_MISMATCH/u);
  assert.throws(() => store.markOutboxSent("terminal:delivered", {
    ...completedReceipt, unknown_field: true,
  }), /V6_TERMINAL_RECEIPT_INVALID/u);
  store.markOutboxSent("terminal:delivered", completedReceipt);
  assert.equal(store.readTask(deliveredTask.job_id)?.status, "accepted");
  assert.equal(store.reconcileDeliveredTerminals(), 0);
  assert.equal(store.readTask(deliveredTask.job_id)?.status, "accepted");
  store.setRecoveryPending(deliveredTask.job_id, "BUSINESS_ADMISSION_PENDING");
  store.completeTask(deliveredTask.job_id, deliveredResult);
  assert.equal(store.readTask(deliveredTask.job_id)?.status, "completed");
  assert.deepEqual(store.readTask(deliveredTask.job_id)?.result, deliveredResult);

  const historical = task({
    jobId: "job:remote-absent-historical-completed", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const historicalIdentity = identityFor(historical);
  store.acceptTask(historical, historicalIdentity);
  store.completeTask(historical.job_id, resultFor(historical, historicalIdentity));
  store.enqueue({
    idempotency_key: "terminal:remote-absent-historical-completed", kind: "terminal",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(historical.job_id)}/terminal`,
    method: "POST", headers: {}, body: "{}",
  });
  assert.equal(store.markRemoteAbsentHistorical(historical.job_id), true);
  assert.deepEqual({
    code: store.readOutboxAuthority("terminal:remote-absent-historical-completed")?.failureCode,
    state: store.readOutboxAuthority("terminal:remote-absent-historical-completed")?.state,
  }, { code: "REMOTE_JOB_ABSENT_HISTORICAL", state: "failed" });

  const current = task({
    jobId: "job:remote-absent-current-nonterminal", productId: "payment_screenshot_observation", actionId: "observe",
  });
  store.acceptTask(current, identityFor(current));
  store.enqueue({
    idempotency_key: "checkpoint:remote-absent-current-nonterminal", kind: "checkpoint",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(current.job_id)}/checkpoints`,
    method: "POST", headers: {}, body: "{}",
  });
  assert.equal(store.markRemoteAbsentHistorical(current.job_id), false);
  assert.equal(store.readOutboxAuthority("checkpoint:remote-absent-current-nonterminal")?.state, "pending");
  assert.equal(store.isLedgerConsistent(new Set()), false);
  store.enqueue({
    idempotency_key: "checkpoint:native-failure", kind: "checkpoint",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(current.job_id)}/checkpoints`,
    method: "POST", headers: {}, body: '{"attempt_failure":true}',
  });
  await assert.rejects(
    store.deliverOutbox("checkpoint:native-failure", HASH_A, async () => {
      throw executionFailure("review_required", "REMOTE_CHECKPOINT_REJECTED", { httpStatus: 409 });
    }),
    /REMOTE_CHECKPOINT_REJECTED/u,
  );
  assert.equal(
    store.readOutboxAuthority("checkpoint:native-failure")?.failureCode,
    "REMOTE_CHECKPOINT_REJECTED",
  );

  const retired = task({
    jobId: "job:authoritative-stale-lease-retired", productId: "payment_screenshot_observation", actionId: "observe",
  });
  store.acceptTask(retired, identityFor(retired));
  store.enqueue({
    idempotency_key: "checkpoint:authoritative-stale-lease-retired", kind: "checkpoint",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(retired.job_id)}/checkpoints`,
    method: "POST", headers: {}, body: "{}",
  });
  assert.ok(store.unreconciledOutboxJobIds().includes(retired.job_id));
  const retiredStates: string[] = [];
  store.setOutboxObserver((authority) => {
    if (authority?.idempotencyKey === "checkpoint:authoritative-stale-lease-retired") {
      retiredStates.push(authority.state);
    }
  });
  await assert.rejects(store.deliverOutbox(
    "checkpoint:authoritative-stale-lease-retired", HASH_A,
    async () => { throw executionFailure("review_required", "AI_LEASE_FENCE_STALE", { httpStatus: 409 }); },
  ), /AI_LEASE_FENCE_STALE/u);
  assert.deepEqual(retiredStates, ["pending", "failed"],
    "an authoritative stale lease must retire atomically without entering the retry or parked states");
  assert.equal(
    store.readOutboxAuthority("checkpoint:authoritative-stale-lease-retired")?.failureCode,
    "STALE_LEASE_OUTBOX_RETIRED:AI_LEASE_FENCE_STALE",
  );
  assert.equal(store.unreconciledOutboxJobIds().includes(retired.job_id), false);
  store.close();

  const isolationDirectory = path.join(temporary, "per-job-failure-isolation");
  await mkdir(isolationDirectory);
  const isolationStore = new ProductionRuntimeStore(isolationDirectory);
  const isolatedFailure = task({
    jobId: "job:isolated-outbox-failure", productId: "payment_screenshot_observation", actionId: "observe",
  });
  isolationStore.acceptTask(isolatedFailure, identityFor(isolatedFailure));
  isolationStore.recordCheckpoint({
    jobId: isolatedFailure.job_id, attemptId: "attempt:isolated-failure", checkpointId: "recovery_pending",
    checkpointHash: HASH_A, state: "persisted",
  });
  isolationStore.recordLease({
    jobId: isolatedFailure.job_id, attemptId: "attempt:isolated-failure", leaseVersion: 1,
    fenceHash: HASH_B, state: "stale", expiresAt: "2026-08-28T00:00:00.000Z",
  });
  isolationStore.setRecoveryPending(isolatedFailure.job_id, "REMOTE_CHECKPOINT_REJECTED");
  isolationStore.enqueue({
    idempotency_key: "checkpoint:isolated-failure", kind: "checkpoint",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(isolatedFailure.job_id)}/checkpoints`,
    method: "POST", headers: {}, body: '{}',
  });
  await assert.rejects(isolationStore.deliverOutbox(
    "checkpoint:isolated-failure", HASH_A,
    async () => { throw executionFailure("review_required", "REMOTE_CHECKPOINT_REJECTED", { httpStatus: 409 }); },
  ), /REMOTE_CHECKPOINT_REJECTED/u);
  const unaffected = task({
    jobId: "job:unaffected-by-other-job-outbox", productId: "payment_screenshot_observation", actionId: "observe",
  });
  isolationStore.acceptTask(unaffected, identityFor(unaffected));
  isolationStore.recordCheckpoint({
    jobId: unaffected.job_id, attemptId: "attempt:unaffected", checkpointId: "accepted",
    checkpointHash: HASH_A, state: "persisted",
  });
  isolationStore.recordLease({
    jobId: unaffected.job_id, attemptId: "attempt:unaffected", leaseVersion: 1,
    fenceHash: HASH_B, state: "active", expiresAt: "2030-01-01T00:05:00.000Z",
  });
  assert.equal(isolationStore.isLedgerConsistent(new Set([unaffected.job_id])), true,
    "one job's failed Outbox must not block an unrelated active job");
  isolationStore.close();

  const boundedOutboxDirectory = path.join(temporary, "bounded-outbox-delivery");
  await mkdir(boundedOutboxDirectory);
  let boundedOutboxStore = new ProductionRuntimeStore(boundedOutboxDirectory);
  const boundedTask = task({
    jobId: "job:bounded-outbox-delivery", productId: "payment_screenshot_observation", actionId: "observe",
  });
  boundedOutboxStore.acceptTask(boundedTask, identityFor(boundedTask));
  const boundedOutboxPath = `/internal/ai-production/v6/jobs/${encodeURIComponent(boundedTask.job_id)}/checkpoints`;
  boundedOutboxStore.enqueue({
    idempotency_key: "checkpoint:bounded-delivery", kind: "checkpoint",
    path: boundedOutboxPath, method: "POST", headers: {}, body: "{}",
  });
  boundedOutboxStore.enqueue({
    idempotency_key: "checkpoint:unrelated-delivery", kind: "checkpoint",
    path: boundedOutboxPath, method: "POST", headers: {}, body: '{"unrelated":true}',
  });
  let deliveryCalls = 0;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await assert.rejects(boundedOutboxStore.deliverOutbox(
      "checkpoint:bounded-delivery", HASH_A,
      async () => {
        deliveryCalls += 1;
        throw executionFailure("review_required", "AI_V6_RECONCILE_OUTCOME_INVALID", { httpStatus: 409 });
      },
    ), /AI_V6_RECONCILE_OUTCOME_INVALID/u);
    const authority = boundedOutboxStore.readOutboxAuthority("checkpoint:bounded-delivery")!;
    assert.equal(authority.deliveryBuildHash, HASH_A);
    assert.equal(authority.deliveryAttemptCount, attempt);
    assert.equal(authority.failureCode, "AI_V6_RECONCILE_OUTCOME_INVALID");
    assert.equal(authority.state, attempt === 3 ? "parked" : "failed");
    assert.equal(Boolean(authority.parkedAt), attempt === 3);
    if (attempt < 3) {
      assert.ok(authority.nextDeliveryAttemptAt);
      const boundedDatabase = Reflect.get(boundedOutboxStore, "database") as Database.Database;
      boundedDatabase.prepare(`update production_outbox set next_delivery_attempt_at=?
        where idempotency_key=?`).run("2000-01-01T00:00:00.000Z", "checkpoint:bounded-delivery");
    } else assert.equal(authority.nextDeliveryAttemptAt, null);
  }
  assert.equal(deliveryCalls, 3, "one build may physically send one Outbox intent at most three times");
  assert.deepEqual(
    boundedOutboxStore.pendingOutbox(HASH_A).map((write) => write.idempotency_key),
    ["checkpoint:unrelated-delivery"],
    "a parked Outbox must disappear from automatic delivery without blocking an unrelated Outbox",
  );
  assert.equal(boundedOutboxStore.parkedOutboxCount(), 1);
  boundedOutboxStore.close();

  boundedOutboxStore = new ProductionRuntimeStore(boundedOutboxDirectory);
  assert.deepEqual(
    boundedOutboxStore.pendingOutbox(HASH_A).map((write) => write.idempotency_key),
    ["checkpoint:unrelated-delivery"],
    "restart with the same build must not reset or replay a parked Outbox",
  );
  await assert.rejects(boundedOutboxStore.deliverOutbox(
    "checkpoint:bounded-delivery", HASH_A,
    async () => { deliveryCalls += 1; return { checkpoint_hash: HASH_A }; },
  ), /PRODUCTION_OUTBOX_DELIVERY_PARKED/u);
  assert.equal(deliveryCalls, 3);
  await boundedOutboxStore.deliverOutbox(
    "checkpoint:bounded-delivery", HASH_B,
    async () => { deliveryCalls += 1; return { checkpoint_hash: HASH_A }; },
  );
  assert.equal(deliveryCalls, 4, "a new build may resume the same durable Outbox debt once");
  assert.equal(boundedOutboxStore.readOutboxAuthority("checkpoint:bounded-delivery")?.state, "delivered");
  assert.equal(boundedOutboxStore.parkedOutboxCount(), 0);
  boundedOutboxStore.close();

  const redeliveryDirectory = path.join(temporary, "historical-failure-remote-redelivery");
  await mkdir(redeliveryDirectory);
  const redeliveryTask = task({
    jobId: "job:historical-failure-remote-redelivery", productId: "payment_screenshot_observation", actionId: "observe",
  });
  let redeliveryStore = new ProductionRuntimeStore(redeliveryDirectory);
  redeliveryStore.acceptTask(redeliveryTask, identityFor(redeliveryTask));
  redeliveryStore.enqueue({
    idempotency_key: "terminal:historical-failure-remote-redelivery", kind: "terminal",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(redeliveryTask.job_id)}/terminal`,
    method: "POST", headers: {}, body: JSON.stringify({ terminal_status: "failed" }),
  });
  redeliveryStore.close();
  const redeliveryDatabase = new Database(path.join(redeliveryDirectory, "production-runtime.sqlite"));
  redeliveryDatabase.prepare("update production_tasks set status='failed' where job_id=?").run(redeliveryTask.job_id);
  redeliveryDatabase.prepare(`update production_outbox
    set sent_at=?,response_json=?,response_hash=?,receipt_hash=? where idempotency_key=?`).run(
    "2026-08-28T00:00:00.000Z", JSON.stringify({ terminal_status: "failed" }), HASH_A, HASH_B,
    "terminal:historical-failure-remote-redelivery",
  );
  redeliveryDatabase.close();
  redeliveryStore = new ProductionRuntimeStore(redeliveryDirectory);
  assert.equal(redeliveryStore.readTask(redeliveryTask.job_id)?.status, "recovery_pending");
  assert.deepEqual(redeliveryStore.readOutboxAuthority(
    "terminal:historical-failure-remote-redelivery",
  ), {
    idempotencyKey: "terminal:historical-failure-remote-redelivery",
    jobId: redeliveryTask.job_id,
    kind: "terminal",
    state: "failed",
    deliveryBuildHash: null,
    deliveryAttemptCount: 0,
    nextDeliveryAttemptAt: null,
    parkedAt: null,
    failureCode: "HISTORICAL_FAILED_COMPLETION_RETIRED",
    responseHash: null,
    receiptHash: null,
  });
  assert.equal(redeliveryStore.isRemoteRedeliveryPending(redeliveryTask.job_id), true);
  assert.equal(redeliveryStore.isLedgerConsistent(new Set()), true,
    "a retired historical failure delegated to Website redelivery must not block unrelated claims");
  redeliveryStore.enqueue({
    idempotency_key: "checkpoint:rejected-before-reconstruction", kind: "checkpoint",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(redeliveryTask.job_id)}/checkpoints`,
    method: "POST", headers: {}, body: "{}",
  });
  await assert.rejects(redeliveryStore.deliverOutbox(
    "checkpoint:rejected-before-reconstruction", HASH_A,
    async () => { throw executionFailure("review_required", "AI_LEASE_ACCEPT_DEADLINE_EXPIRED", { httpStatus: 409 }); },
  ), /AI_LEASE_ACCEPT_DEADLINE_EXPIRED/u);
  const reconstructedIdentity = { ...identityFor(redeliveryTask), plugin_version: 2 };
  const reconstructed = redeliveryStore.acceptTask(redeliveryTask, reconstructedIdentity, false);
  assert.equal(reconstructed.status, "accepted");
  assert.deepEqual(reconstructed.identity, reconstructedIdentity);
  assert.match(reconstructed.failure_reason ?? "", /^EXECUTION_SLICE_RECONSTRUCTED:/u);
  assert.equal(redeliveryStore.readOutboxAuthority(
    "checkpoint:rejected-before-reconstruction",
  )?.failureCode, "EXECUTION_SLICE_RECONSTRUCTED");
  redeliveryStore.markRunning(redeliveryTask.job_id);
  assert.equal(redeliveryStore.readTask(redeliveryTask.job_id)?.failure_reason, null,
    "the transient task diagnosis may clear after execution starts");
  redeliveryStore.close();
  const reconstructionDatabase = new Database(path.join(redeliveryDirectory, "production-runtime.sqlite"));
  const reconstructionRow = reconstructionDatabase.prepare(`select body_blob from production_outbox
    where failure_code='EXECUTION_SLICE_RECONSTRUCTED'
      and path like '%/execution-slice-reconstructions'`).get() as { body_blob: Buffer } | undefined;
  reconstructionDatabase.close();
  assert.ok(reconstructionRow, "execution-slice reconstruction must retain a durable local receipt");
  const reconstructionReceipt = JSON.parse(reconstructionRow.body_blob.toString("utf8")) as Record<string, unknown>;
  assert.equal(reconstructionReceipt.schema_version, "agent-execution-slice-reconstruction.v1");
  assert.deepEqual(reconstructionReceipt.old_identity, identityFor(redeliveryTask));
  assert.deepEqual(reconstructionReceipt.new_identity, reconstructedIdentity);
  assert.deepEqual(reconstructionReceipt.retired_checkpoint_attempts, [{
    idempotencyKey: "checkpoint:rejected-before-reconstruction",
    failureCode: "AI_LEASE_ACCEPT_DEADLINE_EXPIRED",
    createdAt: (reconstructionReceipt.retired_checkpoint_attempts as Array<Record<string, unknown>>)[0]?.createdAt,
  }]);

  const persistedDirectory = path.join(temporary, "persisted-terminal-receipt-mutant");
  await mkdir(persistedDirectory);
  const persistedTask = task({
    jobId: "job:persisted-terminal-receipt", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const persistedIdentity = identityFor(persistedTask);
  const persistedResult = resultFor(persistedTask, persistedIdentity);
  let persistedStore = new ProductionRuntimeStore(persistedDirectory);
  persistedStore.acceptTask(persistedTask, persistedIdentity);
  persistedStore.stageResult(persistedTask.job_id, persistedResult);
  persistedStore.enqueue({
    idempotency_key: "terminal:persisted-mutant", kind: "terminal",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(persistedTask.job_id)}/terminal`,
    method: "POST", headers: {},
    body: JSON.stringify({
      schema_version: "xuanxue-ai-terminal-cas.v6", job_id: persistedTask.job_id,
      terminal_status: "completed", failure: null, payload_hash: hashCanonical(persistedResult),
      worker_session_id: "worker:receipt", worker_session_epoch: 1,
    }),
  });
  const durableReceipt = terminalReceipt({
    jobId: persistedTask.job_id, payloadHash: hashCanonical(persistedResult),
  });
  persistedStore.markOutboxSent("terminal:persisted-mutant", durableReceipt);
  persistedStore.close();
  const corruptedReceipt = { ...durableReceipt, job_id: "job:forged-terminal-owner" };
  const rawDatabase = new Database(path.join(persistedDirectory, "production-runtime.sqlite"));
  rawDatabase.prepare("update production_outbox set response_json=?,response_hash=? where idempotency_key=?").run(
    JSON.stringify(corruptedReceipt), hashCanonical(corruptedReceipt), "terminal:persisted-mutant",
  );
  rawDatabase.close();
  persistedStore = new ProductionRuntimeStore(persistedDirectory);
  assert.throws(() => persistedStore.reconcileDeliveredTerminals(), /V6_TERMINAL_RECEIPT_MISMATCH/u);
  assert.equal(persistedStore.readTask(persistedTask.job_id)?.status, "accepted");
  assert.equal(persistedStore.isLedgerConsistent(new Set()), false);
  persistedStore.close();
} finally {
  await rm(temporary, { recursive: true, force: true });
}
