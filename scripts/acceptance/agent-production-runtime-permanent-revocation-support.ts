import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { executionFailure } from "../../src/lib/execution-failure.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { executeClaim } from "../../src/lib/local-runtime/production/runtime-claim.js";
import type { RuntimeState } from "../../src/lib/local-runtime/production/runtime-state.js";
import { serializeTerminalFailure } from "../../src/lib/local-runtime/production/terminal-failure.js";
import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import { flushOutboxWithLog, reconcilePermanentlyRevokedBrowserQuarantine } from
  "../../src/lib/local-runtime/production/runtime-loops.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import type { ProductionWorkerSession } from "../../src/lib/local-runtime/production/worker-session.js";
import {
  claimTask,
  identityFor,
  recoveryCheckpointBody,
  recoveryCheckpointReceipt,
  task,
} from "./agent-production-runtime-fixtures.js";

const revokedStatus = (jobId: string, receipts: readonly unknown[] = []) => ({
  schema_version: "xuanxue-ai-device-job-status.v6",
  job_id: jobId,
  status: "failed",
  current_reason: { code: "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED" },
  prior_result_rejection: null,
  control_intent: {
    schema_version: "xuanxue-ai-control-intent.v6",
    job_id: jobId,
    intent: "cancel_requested",
    control_epoch: 1,
    reason_code: "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED",
  },
  accepted_attempt_count: 1,
  terminal_status: null,
  terminal_payload_hash: null,
  business_admission_receipt: null,
  business_consumer_error: null,
  write_receipts: receipts,
});

const activeStatus = (jobId: string, receipts: readonly unknown[] = []) => ({
  ...revokedStatus(jobId, receipts),
  current_reason: { code: "LEASE_GRANTED" },
  control_intent: {
    schema_version: "xuanxue-ai-control-intent.v6",
    job_id: jobId,
    intent: "none",
    control_epoch: 0,
    reason_code: null,
  },
});

const runtimeState = (
  store: ProductionRuntimeStore,
  temporary: string,
  session: ProductionWorkerSession,
  jobId: string,
  execute: RuntimeState["executor"]["execute"],
  active = false,
): RuntimeState => {
  const state: object = {
  abort: new AbortController(),
  active: new Map(),
  activeAbort: active ? new Map([[jobId, new AbortController()]]) : new Map(),
  store,
  executor: {
    accept: (
      acceptedTask: Parameters<RuntimeState["executor"]["accept"]>[0],
      attemptId: string,
    ) => store.acceptTask(
      acceptedTask, identityFor(acceptedTask), attemptId,
    ),
    execute,
  },
  session,
  browserAuthority: { readBrowserReconciliationScope: () => null },
  gpt: {},
  dataDir: temporary,
  runtimeLogger: createRuntimeLogger({
    producer: "agent-acceptance", owner: "production-runtime", component: "revocation-acceptance",
    terminalEnabled: false, fileSink: { directoryPath: path.join(temporary, "runtime-logs") },
  }),
  draining: false,
  lastHeartbeat: null,
  lastErrorCode: null,
  lastErrorReason: null,
  stopped: false,
  ledgerReconciled: false,
  reconciliationBaselineValid: true,
  };
  return state as RuntimeState;
};

const assertRevokedOutboxPreserved = (store: ProductionRuntimeStore): void => {
  const jobId = "job:permanently-revoked";
  const outboxIds = ["revoked:checkpoint:1", "revoked:checkpoint:2"] as const;
  const accepted = task({ jobId, productId: "payment_screenshot_observation", actionId: "observe" });
  const attemptId = `attempt:${jobId}`;
  store.acceptTask(accepted, identityFor(accepted), attemptId);
  store.recordAttemptFailure(jobId, attemptId, serializeTerminalFailure(
    executionFailure("failed", "STALE_LOCAL_FAILURE"),
  ));
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
  assert.equal(store.readTask(jobId)?.attempt_failure?.code, "STALE_LOCAL_FAILURE",
    "revocation settlement must preserve a prior failure without an exact rejected Outbox proof");
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

const assertAcceptedFailureCrashRecovery = (store: ProductionRuntimeStore): void => {
  const accepted = task({
    jobId: "job:attempt-failure-crash-recovery",
    productId: "payment_screenshot_observation",
    actionId: "observe",
  });
  const job = claimTask(accepted);
  const failure = serializeTerminalFailure(executionFailure("failed", "PRODUCT_FAILURE_AFTER_CRASH"));
  store.acceptTask(accepted, identityFor(accepted), job.grant.attempt_id);
  const bodies = [
    recoveryCheckpointBody({
      jobId: job.job_id, attemptId: job.grant.attempt_id, requestId: "crash:accepted:1",
      checkpointSeq: 1, checkpointKind: "accepted",
    }),
    recoveryCheckpointBody({
      jobId: job.job_id, attemptId: job.grant.attempt_id, requestId: "crash:progress:2",
      checkpointSeq: 2, checkpointKind: "progress",
    }),
    recoveryCheckpointBody({
      jobId: job.job_id, attemptId: job.grant.attempt_id, requestId: "crash:failure:3",
      checkpointSeq: 3, checkpointKind: "attempt_failure", attemptFailure: failure,
    }),
  ];
  const pathname = `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/checkpoints`;
  const receipts = bodies.map((body) => {
    const receipt = recoveryCheckpointReceipt(body, 1);
    store.enqueue({
      idempotency_key: body.request_id, kind: "checkpoint", path: pathname,
      method: "POST", headers: {}, body: JSON.stringify(body),
    });
    store.markOutboxSent(body.request_id, receipt.response_json);
    return receipt;
  });
  assert.equal(store.readTask(job.job_id)?.attempt_failure, null,
    "the crash point must begin after the remote receipt and before the local failure freeze");
  const beforeOutbox = store.outboxAuthorities();
  assert.deepEqual(store.recoverCheckpointPrefix({
    jobId: job.job_id,
    attemptId: job.grant.attempt_id,
    acceptedAttemptCount: 1,
    receipts,
  }), { checkpointSeq: 3, checkpointHash: receipts[2]!.payload_hash });
  assert.deepEqual(store.readTask(job.job_id)?.attempt_failure, failure,
    "receipt hydration must freeze the exact already-accepted failure without a new intent");
  assert.deepEqual(store.outboxAuthorities(), beforeOutbox,
    "failure crash recovery must not enqueue or resend a checkpoint");
};

const assertRevocationStatusGate = async (
  store: ProductionRuntimeStore,
  temporary: string,
): Promise<void> => {
  const accepted = task({
    jobId: "job:revocation-status-gate",
    productId: "payment_screenshot_observation",
    actionId: "observe",
  });
  const job = claimTask(accepted);
  store.acceptTask(accepted, identityFor(accepted), job.grant.attempt_id);
  const body = recoveryCheckpointBody({
    jobId: job.job_id, attemptId: job.grant.attempt_id, requestId: "revocation:failure:3",
    checkpointSeq: 3, checkpointKind: "attempt_failure",
    attemptFailure: serializeTerminalFailure(executionFailure("failed", "PRODUCT_FAILURE")),
  });
  store.enqueue({
    idempotency_key: body.request_id,
    kind: "checkpoint",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/checkpoints`,
    method: "POST",
    headers: {},
    body: JSON.stringify(body),
  });
  await assert.rejects(store.deliverOutbox(body.request_id, async () => {
    throw runtimeTransportFailure("AI_PERMANENT_AUTHORIZATION_REVOKED", 409);
  }), /AI_PERMANENT_AUTHORIZATION_REVOKED/u);
  store.recordAttemptFailure(job.job_id, job.grant.attempt_id,
    body.attempt_failure as ReturnType<typeof serializeTerminalFailure>);
  const authority = store.readOutboxAuthority(body.request_id)!;
  assert.equal(authority.lastError, "AI_PERMANENT_AUTHORIZATION_REVOKED");
  assert.ok(authority.nextDeliveryAt !== null
    && Date.parse(authority.nextDeliveryAt) - Date.now() <= 5_100,
  "the exact revocation 409 must enter the short status-read gate before generic 4xx backoff");

  const database = Reflect.get(store, "database") as Database.Database;
  let statusMode: "temporary-failure" | "mismatch" | "revoked" = "temporary-failure";
  let mutationSends = 0;
  const session: object = {
    request: async (pathname: string) => {
      if (!pathname.endsWith("/device-status")) {
        mutationSends += 1;
        throw new Error(`OUTBOX_MUTATION_MUST_NOT_REPLAY:${pathname}`);
      }
      if (statusMode === "temporary-failure") {
        throw executionFailure("failed", "CLOUD_TRANSPORT_UNAVAILABLE");
      }
      return statusMode === "mismatch" ? activeStatus(job.job_id) : revokedStatus(job.job_id);
    },
  };
  const state = runtimeState(store, temporary, session as ProductionWorkerSession, job.job_id, async () => {
    throw new Error("PRODUCT_EXECUTION_MUST_NOT_START");
  });
  for (const mode of ["temporary-failure", "mismatch", "revoked"] as const) {
    statusMode = mode;
    database.prepare("update production_outbox set next_delivery_at=? where idempotency_key=?")
      .run(new Date(0).toISOString(), body.request_id);
    await flushOutboxWithLog(state);
    assert.equal(mutationSends, 0, `${mode} authority must never replay the rejected mutation`);
    if (mode !== "revoked") {
      assert.equal(store.readOutboxAuthority(body.request_id)?.lastError,
        "AI_PERMANENT_AUTHORIZATION_REVOKED");
      assert.notEqual(store.readTask(job.job_id)?.current_reason,
        "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED",
      "temporary or mismatched status must not mint permanent revocation");
    }
  }
  assert.equal(store.readTask(job.job_id)?.current_reason, "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED");
  assert.equal(store.readTask(job.job_id)?.attempt_failure, null,
    "only the exact failure projection bound to the rejected 409 intent may be removed");
  assert.equal(store.readOutboxAuthority(body.request_id)?.nextDeliveryAt, null);
};

const assertActiveRevocationSettlement = async (
  store: ProductionRuntimeStore,
  temporary: string,
): Promise<void> => {
  const accepted = task({
    jobId: "job:active-revocation-settlement",
    productId: "payment_screenshot_observation",
    actionId: "observe",
  });
  const job = claimTask(accepted);
  let statusReads = 0;
  let releaseCount = 0;
  let productExecutions = 0;
  const checkpointBodies: Record<string, unknown>[] = [];
  const session: object = {
    workerSessionId: job.grant.worker_session_id,
    workerSessionEpoch: job.grant.worker_session_epoch,
    device: { server_base_url: "https://production.invalid" },
    request: async (pathname: string, init: { body?: string }) => {
      if (pathname.endsWith("/device-status")) {
        statusReads += 1;
        return statusReads === 1 ? activeStatus(job.job_id) : revokedStatus(job.job_id);
      }
      if (pathname.endsWith("/checkpoints")) {
        const body = JSON.parse(init.body ?? "{}") as Record<string, unknown>;
        checkpointBodies.push(body);
        if (body.checkpoint_kind === "attempt_failure") {
          throw runtimeTransportFailure("AI_PERMANENT_AUTHORIZATION_REVOKED", 409);
        }
        return {
          schema_version: "xuanxue-ai-checkpoint-receipt.v6",
          job_id: job.job_id,
          checkpoint_seq: body.checkpoint_seq,
          checkpoint_hash: hashCanonical(body),
          accepted_at: "2026-09-06T00:00:00.000Z",
          accepted_attempt_count: 1,
          status: "failed",
        };
      }
      if (pathname.endsWith("/lease-release")) {
        releaseCount += 1;
        const body = JSON.parse(init.body ?? "{}") as Record<string, unknown>;
        assert.equal(body.job_id, job.job_id);
        assert.equal(body.attempt_id, job.grant.attempt_id);
        assert.equal(body.lease_version, job.grant.lease_version);
        return {
          schema_version: "xuanxue-ai-lease-release-receipt.v6",
          job_id: job.job_id,
          task_status: "failed",
          lease_disposition: "released",
          reason_code: body.reason_code,
          payload_hash: body.payload_hash,
          terminal_payload_hash: null,
        };
      }
      throw new Error(`UNEXPECTED_REVOCATION_REQUEST:${pathname}`);
    },
  };
  const state = runtimeState(store, temporary, session as ProductionWorkerSession, job.job_id, async () => {
    productExecutions += 1;
    throw executionFailure("failed", "PRODUCT_FAILURE_DURING_DELETION");
  }, true);
  await executeClaim(state, job);
  assert.equal(productExecutions, 1);
  assert.deepEqual(checkpointBodies.map((body) => body.checkpoint_kind), [
    "accepted", "progress", "attempt_failure",
  ]);
  assert.equal(releaseCount, 1, "confirmed revocation must release the exact lease once");
  assert.equal(store.readTask(job.job_id)?.attempt_failure, null,
    "a Website-rejected failure checkpoint must never freeze a local attempt failure");
  assert.equal(store.readTask(job.job_id)?.current_reason, "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED");
  assert.equal(store.pendingOutbox().length, 0);
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
        prior_result_rejection: null,
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
    for (const [name, exercise] of [
      ["crash", async (candidate: ProductionRuntimeStore, _directory: string) => {
        assertAcceptedFailureCrashRecovery(candidate);
      }],
      ["status", assertRevocationStatusGate],
      ["active", assertActiveRevocationSettlement],
    ] as const) {
      const directory = path.join(temporary, name);
      await mkdir(directory);
      const candidate = new ProductionRuntimeStore(directory);
      await exercise(candidate, directory);
      candidate.close();
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
};
