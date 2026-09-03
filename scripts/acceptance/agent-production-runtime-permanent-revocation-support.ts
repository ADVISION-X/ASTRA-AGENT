import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { identityFor, task } from "./agent-production-runtime-fixtures.js";

export const assertPermanentRevocationSettlement = async (): Promise<void> => {
  const temporary = await mkdtemp(path.join(tmpdir(), "agent-production-revocation-"));
  const jobId = "job:permanently-revoked";
  const outboxIds = ["revoked:checkpoint:1", "revoked:checkpoint:2"] as const;
  try {
    const store = new ProductionRuntimeStore(temporary);
    const accepted = task({
      jobId, productId: "payment_screenshot_observation", actionId: "observe",
    });
    store.acceptTask(accepted, identityFor(accepted), `attempt:${jobId}`);
    for (const [index, idempotencyKey] of outboxIds.entries()) {
      store.enqueue({
        idempotency_key: idempotencyKey,
        kind: "checkpoint",
        path: `/internal/ai-production/v6/jobs/${encodeURIComponent(jobId)}/checkpoints`,
        method: "POST",
        headers: {},
        body: JSON.stringify({ job_id: jobId, checkpoint_seq: index + 1 }),
      });
    }
    const database = Reflect.get(store, "database") as Database.Database;
    const beforeBodies = database.prepare(
      "select idempotency_key,hex(body_blob) as body from production_outbox order by idempotency_key",
    ).all();
    assert.equal(store.settlePermanentlyRevokedJob(
      jobId, "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED",
    ), 2);
    assert.equal(store.readTask(jobId)?.current_reason, "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED");
    assert.equal(store.pendingOutbox().length, 0,
      "a Website-proven permanent revocation must stop local delivery without deleting evidence");
    assert.equal(store.outboxAuthorities().length, 2, "revocation must preserve every Outbox intent");
    for (const idempotencyKey of outboxIds) {
      assert.deepEqual(store.readOutboxAuthority(idempotencyKey), {
        idempotencyKey,
        jobId,
        kind: "checkpoint",
        state: "pending",
        nextDeliveryAt: null,
        lastError: "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED",
        responseHash: null,
        receiptHash: null,
      });
    }
    assert.deepEqual(database.prepare(
      "select idempotency_key,hex(body_blob) as body from production_outbox order by idempotency_key",
    ).all(), beforeBodies, "revocation must not rewrite or discard the original intent payloads");
    store.close();

    const reopened = new ProductionRuntimeStore(temporary);
    assert.equal(reopened.pendingOutbox().length, 0,
      "startup must not restore a delivery schedule for an exactly revoked job");
    assert.equal(reopened.outboxAuthorities().length, 2,
      "startup must preserve the revoked job's complete Outbox evidence");
    for (const idempotencyKey of outboxIds) {
      const authority = reopened.readOutboxAuthority(idempotencyKey)!;
      assert.equal(authority.lastError, "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED");
      assert.equal(authority.nextDeliveryAt, null);
      assert.equal(authority.state, "pending");
    }
    reopened.close();
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
};
