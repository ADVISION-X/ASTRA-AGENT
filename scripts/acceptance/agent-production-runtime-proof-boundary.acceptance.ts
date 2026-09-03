import assert from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { sentProductionCheckpointPrefix } from "./agent-production-runtime.real-proof-support.js";

const temporary = await mkdtemp(path.join(tmpdir(), "agent-production-proof-boundary-"));
const databasePath = path.join(temporary, "production-runtime.sqlite");
const database = new Database(databasePath);
try {
  database.exec(`create table production_outbox(
    idempotency_key text primary key,kind text,path text,body_blob blob,sent_at text,created_at text
  )`);
  const insert = database.prepare(`insert into production_outbox
    (idempotency_key,kind,path,body_blob,sent_at,created_at) values(?,?,?,?,?,?)`);
  for (const jobId of ["job:a_b", "job:acb"] as const) {
    const timestamp = new Date().toISOString();
    insert.run(
      `proof:${jobId}`, "checkpoint",
      `/internal/ai-production/v6/jobs/${encodeURIComponent(jobId)}/checkpoints`,
      Buffer.from(JSON.stringify({
        attempt_id: `attempt:${jobId}`, checkpoint_seq: 1, checkpoint_kind: "accepted",
      })), timestamp, timestamp,
    );
  }
} finally {
  database.close();
}
try {
  assert.deepEqual(sentProductionCheckpointPrefix(databasePath, "job:a_b"), {
    attemptId: "attempt:job:a_b", acceptedSeq1: true, progressSeq2: false, progressSeq3: false,
  }, "Runtime proof must not read a LIKE-wildcard neighbor as the requested job");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
