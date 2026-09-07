import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";

import { executionFailure } from "../../src/lib/execution-failure.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { serializeTerminalFailure } from
  "../../src/lib/local-runtime/production/terminal-failure.js";
import { retireProductionTaskCatalogIdentity } from
  "../maintenance/production-runtime-catalog-identity-retire.js";
import { HASH_A, HASH_B, identityFor, task } from "./agent-production-runtime-fixtures.js";

export const exerciseProductionRuntimeCatalogIdentityRetirement = async (
  temporary: string,
): Promise<void> => {
  const dataDirectory = path.join(temporary, "retired-task-catalog-identity");
  await mkdir(dataDirectory);
  const store = new ProductionRuntimeStore(dataDirectory);
  const accepted = task({
    jobId: "job:retired-task-catalog", productId: "bazi_ai_full_analysis", actionId: "produce",
  });
  store.acceptTask(accepted, identityFor(accepted), "attempt:retired-task-catalog");
  store.recordAttemptFailure(accepted.job_id, "attempt:retired-task-catalog",
    serializeTerminalFailure(executionFailure("failed", "PROVIDER_REJECTED")));
  store.recordCheckpoint({ jobId: accepted.job_id, attemptId: "attempt:retired-task-catalog",
    checkpointId: "attempt_failure", checkpointHash: null, state: "failed" });
  store.recordLease({ jobId: accepted.job_id, attemptId: "attempt:retired-task-catalog",
    leaseVersion: 1, fenceHash: HASH_A, state: "absent", expiresAt: null });
  store.enqueue({ idempotency_key: "outbox:retired-task-catalog", kind: "checkpoint",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(accepted.job_id)}/checkpoints`,
    method: "POST", headers: {}, body: "{}" });
  store.close();

  const legacyDatabase = new Database(path.join(dataDirectory, "production-runtime.sqlite"));
  const storedIdentity = JSON.parse((legacyDatabase.prepare(
    "select identity_json from production_tasks where job_id=?",
  ).get(accepted.job_id) as { identity_json: string }).identity_json) as Record<string, unknown>;
  legacyDatabase.prepare("update production_tasks set identity_json=? where job_id=?")
    .run(JSON.stringify({ catalog_hash: HASH_A, ...storedIdentity }), accepted.job_id);
  legacyDatabase.prepare(`insert into production_continuations(
    continuation_ref,reservation_kind,reservation_identity_hash,origin_job_id,origin_plugin_version,
    plugin_id,owner_ref,subject_ref,authorization_ref,lane_version,created_at
  ) values(?,?,?,?,?,?,?,?,?,?,?)`).run(
    "continuation:retired-task-catalog", "persisted", HASH_B, accepted.job_id, 13,
    "localization-production", "owner", "subject", "authorization", 0, "2026-09-07T00:00:00.000Z",
  );
  legacyDatabase.close();

  assert.deepEqual(retireProductionTaskCatalogIdentity(dataDirectory), {
    status: "migrated", migratedTaskCount: 1,
  });
  const migratedStore = new ProductionRuntimeStore(dataDirectory);
  assert.equal("catalog_hash" in migratedStore.readTask(accepted.job_id)!.identity, false);
  const preservedDatabase = Reflect.get(migratedStore, "database") as Database.Database;
  for (const table of ["production_tasks", "production_attempt_failures", "production_continuations",
    "production_outbox", "production_checkpoints", "production_leases"]) {
    assert.equal((preservedDatabase.prepare(`select count(*) count from ${table}`).get() as { count: number }).count, 1,
      `${table} must be preserved across task identity retirement`);
  }
  migratedStore.close();
  assert.deepEqual(retireProductionTaskCatalogIdentity(dataDirectory), {
    status: "already-current", migratedTaskCount: 0,
  });
};
