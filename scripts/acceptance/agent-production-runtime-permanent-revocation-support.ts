import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { reconcilePermanentlyRevokedBrowserQuarantine } from
  "../../src/lib/local-runtime/production/runtime-loops.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { identityFor, task } from "./agent-production-runtime-fixtures.js";

const assertRevokedOutboxPreserved = (store: ProductionRuntimeStore): void => {
  const jobId = "job:permanently-revoked";
  const outboxIds = ["revoked:checkpoint:1", "revoked:checkpoint:2"] as const;
  const accepted = task({ jobId, productId: "payment_screenshot_observation", actionId: "observe" });
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
  assert.equal(store.settlePermanentlyRevokedJob(jobId, "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED"), 2);
  assert.equal(store.readTask(jobId)?.current_reason, "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED");
  assert.equal(store.pendingOutbox().length, 0,
    "a Website-proven permanent revocation must stop local delivery without deleting evidence");
  assert.equal(store.outboxAuthorities().length, 2, "revocation must preserve every Outbox intent");
  for (const idempotencyKey of outboxIds) assert.deepEqual(store.readOutboxAuthority(idempotencyKey), {
    idempotencyKey, jobId, kind: "checkpoint", state: "pending", nextDeliveryAt: null,
    lastError: "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED", responseHash: null, receiptHash: null,
  });
  assert.deepEqual(database.prepare(
    "select idempotency_key,hex(body_blob) as body from production_outbox order by idempotency_key",
  ).all(), beforeBodies, "revocation must not rewrite or discard the original intent payloads");
};

const assertBrowserRevocationSurvivesLogFailure = async (
  store: ProductionRuntimeStore,
  temporary: string,
): Promise<void> => {
  const quarantineJobId = "job:permanently-revoked-browser-quarantine";
  const quarantineTask = task({
    jobId: quarantineJobId, productId: "payment_screenshot_observation", actionId: "observe",
  });
  store.acceptTask(quarantineTask, identityFor(quarantineTask), `attempt:${quarantineJobId}`);
  let browserScopePresent = true;
  let physicalReconciliations = 0;
  await reconcilePermanentlyRevokedBrowserQuarantine({
    activeAbort: new Map(),
    browserAuthority: {
      readCurrentTargetLocalReconciliationCandidate: () => ({ jobId: quarantineJobId }),
      readBrowserReconciliationScope: ({ jobId: candidateJobId }: { jobId: string }) =>
        browserScopePresent && candidateJobId === quarantineJobId ? {} : null,
      reconcilePermanentlyRevokedTargetLocal: async ({ jobId: candidateJobId }: { jobId: string }) => {
        assert.equal(candidateJobId, quarantineJobId);
        physicalReconciliations += 1;
        browserScopePresent = false;
        throw new Error("RUNTIME_LOG_SINK_WRITE_FAILED");
      },
    },
    session: {
      request: async () => ({
        schema_version: "xuanxue-ai-device-job-status.v6",
        job_id: quarantineJobId,
        status: "failed",
        current_reason: { code: "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED" },
        control_intent: {
          schema_version: "xuanxue-ai-control-intent.v6",
          job_id: quarantineJobId,
          intent: "cancel_requested",
          control_epoch: 1,
          reason_code: "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED",
        },
        accepted_attempt_count: 1,
        terminal_status: null,
        terminal_payload_hash: null,
        business_admission_receipt: null,
        business_consumer_error: null,
        write_receipts: [],
      }),
    },
    store,
    runtimeLogger: createRuntimeLogger({
      producer: "agent-acceptance", owner: "production-runtime", component: "revocation-acceptance",
      terminalEnabled: false, fileSink: { directoryPath: path.join(temporary, "runtime-logs") },
    }),
  } as never);
  assert.equal(physicalReconciliations, 1,
    "a sent-Outbox Browser quarantine must consume exact Website revocation independently");
  assert.equal(store.readTask(quarantineJobId)?.current_reason,
    "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED",
    "Runtime must re-read Browser scope after a post-WAL logging failure and remove the stale suffix");
};

export const assertPermanentRevocationSettlement = async (): Promise<void> => {
  const temporary = await mkdtemp(path.join(tmpdir(), "agent-production-revocation-"));
  try {
    const store = new ProductionRuntimeStore(temporary);
    assertRevokedOutboxPreserved(store);
    store.close();
    const reopened = new ProductionRuntimeStore(temporary);
    assert.equal(reopened.pendingOutbox().length, 0,
      "startup must not restore a delivery schedule for an exactly revoked job");
    assert.equal(reopened.outboxAuthorities().length, 2,
      "startup must preserve the revoked job's complete Outbox evidence");
    for (const authority of reopened.outboxAuthorities()) {
      assert.equal(authority.lastError, "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED");
      assert.equal(authority.nextDeliveryAt, null);
      assert.equal(authority.state, "pending");
    }
    await assertBrowserRevocationSurvivesLogFailure(reopened, temporary);
    reopened.close();
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
};
