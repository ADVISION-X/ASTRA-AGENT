import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";

import { typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { resolveStoredProductionAuthority } from
  "../../src/lib/local-runtime/production/store-authority-reader.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { HASH_A } from "./agent-production-runtime-fixtures.js";

/** Ordinary startup validates the three-table store read-only: no migration, no repair, no silent bootstrap. */
export const verifyOrdinaryStartupRejectsSchemaMigration = async (temporary: string): Promise<void> => {
  const previousHandoffDirectory = path.join(temporary, "previous-handoff-shape");
  await mkdir(previousHandoffDirectory);
  new ProductionRuntimeStore(previousHandoffDirectory).close();
  const previousHandoff = new Database(path.join(previousHandoffDirectory, "production-runtime.sqlite"));
  previousHandoff.exec(`drop table production_attempt_handoffs;
    create table production_attempt_handoffs(
      job_id text not null, source_attempt_id text not null,
      issued_attempt_id text, seal_hash text not null,
      source_manifest_json text not null, first_fact_raw text,
      sealed_at text not null, accepted_at text,
      primary key(job_id,source_attempt_id)
    )`);
  const originalManifest = JSON.stringify({ seal_hash: HASH_A, source: "preserved" });
  previousHandoff.prepare(`insert into production_attempt_handoffs(
    job_id,source_attempt_id,issued_attempt_id,seal_hash,source_manifest_json,
    first_fact_raw,sealed_at,accepted_at) values(?,?,?,?,?,?,?,?)`).run(
    "job:preserved", "attempt:source", "attempt:issued", HASH_A,
    originalManifest, JSON.stringify({ code: "original" }),
    "2026-09-23T00:00:00.000Z", "2026-09-23T00:01:00.000Z",
  );
  previousHandoff.close();
  assert.throws(() => new ProductionRuntimeStore(previousHandoffDirectory),
    (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_SCHEMA_MIGRATION_REQUIRED",
    "ordinary startup must not migrate a previous handoff table");
  const unchangedPrevious = new Database(path.join(previousHandoffDirectory, "production-runtime.sqlite"));
  assert.deepEqual(unchangedPrevious.prepare(`select seal_hash,source_manifest_json,
    first_fact_raw from production_attempt_handoffs where job_id='job:preserved'`).get(), {
    seal_hash: HASH_A, source_manifest_json: originalManifest,
    first_fact_raw: JSON.stringify({ code: "original" }),
  }, "the previous handoff record must remain byte-for-byte available for an authorized offline cutover");
  unchangedPrevious.close();

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
};
