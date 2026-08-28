import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { uploadProductionResult } from "../../src/lib/local-runtime/production/cloud-client.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
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
    jobId: deliveredTask.job_id, status: "completed", payloadHash: hashCanonical(deliveredResult), failure: null,
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
  assert.equal(store.reconcileDeliveredTerminals(), 1);
  assert.equal(store.readTask(deliveredTask.job_id)?.status, "completed");
  assert.deepEqual(store.readTask(deliveredTask.job_id)?.result, deliveredResult);

  const failedTask = task({ jobId: "job:typed-failure", productId: "payment_screenshot_observation", actionId: "observe" });
  store.acceptTask(failedTask, identityFor(failedTask));
  const terminalFailure = {
    code: "PROVIDER_REJECTED", mutation_outcome: "no" as const, evidence_ref: "rec-proof",
    evidence_hash: HASH_C, cause: { name: "ProviderError", code: "PROVIDER_REJECTED" },
  };
  const failedPayloadHash = hashCanonical({ job_id: failedTask.job_id, failure: terminalFailure });
  store.enqueue({
    idempotency_key: "terminal:failed", kind: "terminal",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(failedTask.job_id)}/terminal`,
    method: "POST", headers: {},
    body: JSON.stringify({
      schema_version: "xuanxue-ai-terminal-cas.v6", job_id: failedTask.job_id, terminal_status: "failed",
      failure: terminalFailure, payload_hash: failedPayloadHash,
      worker_session_id: "worker:receipt", worker_session_epoch: 1,
    }),
  });
  const failedReceipt = terminalReceipt({
    jobId: failedTask.job_id, status: "failed", payloadHash: failedPayloadHash, failure: terminalFailure,
  });
  assert.throws(() => store.markOutboxSent("terminal:failed", {
    ...failedReceipt, failure: { ...terminalFailure, code: "WRONG_FAILURE" },
  }), /V6_TERMINAL_RECEIPT_MISMATCH/u);
  store.markOutboxSent("terminal:failed", failedReceipt);
  assert.equal(store.reconcileDeliveredTerminals(), 1);
  assert.deepEqual(store.readTask(failedTask.job_id)?.failure, terminalFailure);

  const historical = task({
    jobId: "job:remote-absent-historical-failed", productId: "payment_screenshot_observation", actionId: "observe",
  });
  store.acceptTask(historical, identityFor(historical));
  store.setTerminal(historical.job_id, "failed", terminalFailure, null);
  store.enqueue({
    idempotency_key: "terminal:remote-absent-historical-failed", kind: "terminal",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(historical.job_id)}/terminal`,
    method: "POST", headers: {}, body: "{}",
  });
  assert.equal(store.markRemoteAbsentHistorical(historical.job_id), true);
  assert.deepEqual({
    code: store.readOutboxAuthority("terminal:remote-absent-historical-failed")?.failureCode,
    state: store.readOutboxAuthority("terminal:remote-absent-historical-failed")?.state,
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
  store.close();

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
    jobId: persistedTask.job_id, status: "completed", payloadHash: hashCanonical(persistedResult), failure: null,
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

export const agentProductionLedgerAcceptancePassed = true;
