import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { executionFailure, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { resolveStoredProductionAuthority } from
  "../../src/lib/local-runtime/production/store-authority-reader.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { serializeTerminalFailure } from "../../src/lib/local-runtime/production/terminal-failure.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { HASH_A, HASH_B, identityFor, task } from "./agent-production-runtime-fixtures.js";
import { verifyBrowserFailureStoreContract } from
  "./agent-production-runtime-browser-failure.acceptance-support.js";

const temporary = await mkdtemp(path.join(tmpdir(), "agent-production-ledger-"));
const tableNames = (database: Database.Database): string[] =>
  (database.prepare(`select name from sqlite_master where type='table' and name like 'production_%'
    order by name`).all() as Array<{ name: string }>).map((row) => row.name);
const columns = (database: Database.Database, table: string): string[] =>
  (database.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name);

try {
  const dataDirectory = path.join(temporary, "three-table-store");
  await mkdir(dataDirectory);
  const store = new ProductionRuntimeStore(dataDirectory);
  const database = Reflect.get(store, "database") as Database.Database;
  assert.deepEqual(tableNames(database), ["production_leases", "production_outbox", "production_tasks"]);
  assert.equal(columns(database, "production_tasks").includes("attempt_failure_json"), true);
  assert.equal(tableNames(database).includes("production_attempt_failures"), false);
  assert.equal(tableNames(database).includes("production_checkpoints"), false);
  assert.equal(tableNames(database).includes("production_continuations"), false);

  const accepted = task({
    jobId: "job:three-truths", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const identity = identityFor(accepted);
  const firstAttempt = "attempt:three-truths:1";
  store.acceptTask(accepted, identity, firstAttempt);
  store.markExecuting(accepted.job_id);
  const firstFailure = serializeTerminalFailure(executionFailure("failed", "PROVIDER_REJECTED"));
  store.recordAttemptFailure(accepted.job_id, firstAttempt, firstFailure);
  store.recordAttemptFailure(accepted.job_id, firstAttempt, firstFailure);
  assert.deepEqual(store.readTask(accepted.job_id)?.attempt_failure, firstFailure);
  verifyBrowserFailureStoreContract(store);
  assert.throws(() => store.recordAttemptFailure(
    accepted.job_id,
    firstAttempt,
    serializeTerminalFailure(executionFailure("failed", "DIFFERENT_FAILURE")),
  ), /PRODUCTION_ATTEMPT_FAILURE_IMMUTABLE/u);

  store.recordLease({
    jobId: accepted.job_id, attemptId: firstAttempt, leaseVersion: 1,
    fenceHash: HASH_A, state: "stale", expiresAt: null,
  });
  const secondAttempt = "attempt:three-truths:2";
  const second = store.acceptTask(accepted, identity, secondAttempt);
  assert.equal(second.current_attempt_id, secondAttempt);
  assert.equal(second.attempt_failure, null);
  assert.equal(store.readLease(accepted.job_id), null);
  assert.throws(() => store.acceptTask(accepted, identity, secondAttempt),
    /PRODUCTION_ATTEMPT_ALREADY_ACCEPTED/u);

  const artifactKey = "artifact:three-truths";
  store.enqueue({
    idempotency_key: artifactKey,
    kind: "artifact",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(accepted.job_id)}/artifacts/result`,
    method: "PUT",
    headers: {},
    body: Buffer.from("result"),
  });
  assert.equal(store.pendingOutboxCount(), 1);
  store.markOutboxSent(artifactKey, { receipt_hash: HASH_B });
  assert.equal(store.pendingOutboxCount(), 0);
  const outboxAuthority = store.readOutboxAuthority(artifactKey)!;
  assert.equal(resolveStoredProductionAuthority(
    dataDirectory, `production-outbox:${artifactKey}`, hashCanonical(outboxAuthority),
  ), "verified");
  const taskAuthority = store.readTask(accepted.job_id)!;
  assert.equal(resolveStoredProductionAuthority(
    dataDirectory, `production-task:${accepted.job_id}`, hashCanonical(taskAuthority),
  ), "verified");
  assert.equal(resolveStoredProductionAuthority(
    dataDirectory, `production-task:${accepted.job_id}`, HASH_A,
  ), "mismatch");
  store.close();

  const legacyDirectory = path.join(temporary, "legacy");
  await mkdir(legacyDirectory);
  const legacy = new Database(path.join(legacyDirectory, "production-runtime.sqlite"));
  legacy.exec("create table production_checkpoints(job_id text primary key)");
  legacy.close();
  assert.throws(() => new ProductionRuntimeStore(legacyDirectory), /PRODUCTION_SCHEMA_MIGRATION_REQUIRED/u);

  const missingDirectory = path.join(temporary, "missing");
  await mkdir(missingDirectory);
  assert.throws(
    () => resolveStoredProductionAuthority(missingDirectory, "production-task:job:missing", HASH_A),
    (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_AUTHORITY_STORE_MISSING",
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}

for (const evidenceMode of ["exam.golden", "exam.property", "exam.state-machine"] as const) {
  emitQualityProofObservation({
    lawId: "LAW-AGENT-PRODUCTION-RUNTIME-005-V19",
    evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "forbidden:3", "summary"],
    locator: `acceptance:agent-production-runtime:three-table-authority:${evidenceMode}`,
    observedValue: "three-table SQLite authority stores current task failure inline and rejects checkpoint continuation or failure-ledger schemas",
  });
}
