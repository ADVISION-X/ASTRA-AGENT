import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { executeClaim } from "../../src/lib/local-runtime/production/runtime-claim.js";
import type { RuntimeState } from "../../src/lib/local-runtime/production/runtime-state.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import type { ProductionWorkerSession } from "../../src/lib/local-runtime/production/worker-session.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import {
  executionFailure,
} from "../../src/lib/execution-failure.js";
import {
  postSubmitReadbackFault,
  postSubmitReadbackReceipt,
} from "../../src/lib/local-runtime/production/plugin.js";
import {
  HASH_A,
  HASH_B,
  claimTask,
  identityFor,
  reclaimedRecoveryJob as reclaimedJob,
  recoveryCheckpointBody,
  recoveryCheckpointReceipt as checkpointReceipt,
  recoveryRemoteStatus as remoteStatus,
  seedRecoveryIncident,
  task,
  type RecoveryIncident,
} from "./agent-production-runtime-fixtures.js";

const recoverySession = (
  job: RecoveryIncident["job"],
  receipts: RecoveryIncident["receipts"],
  checkpointBodies: Record<string, unknown>[],
  releaseBodies: Record<string, unknown>[] = [],
) => ({
  workerSessionId: job.grant.worker_session_id,
  workerSessionEpoch: job.grant.worker_session_epoch,
  device: { server_base_url: "https://production.invalid" },
  request: async (pathname: string, init: { body?: string }) => {
    if (pathname.endsWith("/device-status")) {
      return {
        ...remoteStatus(receipts),
        job_id: job.job_id,
        control_intent: { ...remoteStatus().control_intent, job_id: job.job_id },
        accepted_attempt_count: job.grant.accepted_attempt_count,
      };
    }
    if (pathname.endsWith("/checkpoints")) {
      const body = JSON.parse(init.body ?? "{}") as Record<string, unknown>;
      checkpointBodies.push(body);
      return {
        schema_version: "xuanxue-ai-checkpoint-receipt.v6",
        job_id: job.job_id,
        checkpoint_seq: body.checkpoint_seq,
        checkpoint_hash: hashCanonical(body),
        accepted_at: "2026-08-29T20:19:07.000Z",
        accepted_attempt_count: job.grant.accepted_attempt_count,
        status: "failed",
      };
    }
    if (pathname.endsWith("/lease-release")) {
      const body = JSON.parse(init.body ?? "{}") as Record<string, unknown>;
      releaseBodies.push(body);
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
    throw new Error(`UNEXPECTED_RUNTIME_REQUEST:${pathname}`);
  },
}) as ProductionWorkerSession;

const recoveryRuntimeState = (input: Readonly<{
  store: ProductionRuntimeStore;
  dataDir: string;
  incident: Readonly<{ accepted: RecoveryIncident["accepted"] }>;
  job: RecoveryIncident["job"];
  abort: AbortController;
  session: ProductionWorkerSession;
  execute: RuntimeState["executor"]["execute"];
}>): RuntimeState => ({
  abort: new AbortController(),
  active: new Map(),
  activeAbort: new Map([[input.job.job_id, input.abort]]),
  store: input.store,
  executor: {
    accept: (acceptedTask: typeof input.incident.accepted, attemptId: string) =>
      input.store.acceptTask(acceptedTask, identityFor(acceptedTask), attemptId),
    execute: input.execute,
  },
  session: input.session,
  browserAuthority: {},
  gpt: {},
  dataDir: input.dataDir,
  runtimeLogger: createRuntimeLogger({
    producer: "agent-acceptance", owner: "production-runtime", component: "recovery-acceptance",
    terminalEnabled: false, fileSink: { directoryPath: path.join(input.dataDir, "runtime-logs") },
  }),
  draining: false,
  lastHeartbeat: null,
  lastErrorCode: null,
  lastErrorReason: null,
  stopped: false,
  ledgerReconciled: false,
  reconciliationBaselineValid: true,
} as RuntimeState);

const recoveryTemporary = await mkdtemp(path.join(tmpdir(), "agent-production-resume-proof-"));
try {
  let store = new ProductionRuntimeStore(recoveryTemporary);
  const acceptedOnlyTask = task({
    jobId: "job:recovery:accepted-only", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const acceptedOnlyOriginalJob = claimTask(acceptedOnlyTask);
  const acceptedOnlyAttemptId = acceptedOnlyOriginalJob.grant.attempt_id;
  store.acceptTask(acceptedOnlyTask, identityFor(acceptedOnlyTask), acceptedOnlyAttemptId);
  const acceptedOnlyPath =
    `/internal/ai-production/v6/jobs/${encodeURIComponent(acceptedOnlyTask.job_id)}/checkpoints`;
  const acceptedOnlyBody = recoveryCheckpointBody({
    jobId: acceptedOnlyTask.job_id, attemptId: acceptedOnlyAttemptId,
    requestId: "accepted-only:accepted:1", checkpointSeq: 1, checkpointKind: "accepted",
  });
  const acceptedOnlyReceipt = checkpointReceipt(acceptedOnlyBody, 1);
  store.enqueue({
    idempotency_key: acceptedOnlyBody.request_id, kind: "checkpoint", path: acceptedOnlyPath,
    method: "POST", headers: {}, body: JSON.stringify(acceptedOnlyBody),
  });
  store.markOutboxSent(acceptedOnlyBody.request_id, acceptedOnlyReceipt.response_json);
  assert.equal(store.recoverCheckpointPrefix({
    jobId: acceptedOnlyTask.job_id, attemptId: acceptedOnlyAttemptId, acceptedAttemptCount: 1,
    receipts: [acceptedOnlyReceipt],
  }).checkpointSeq, 1);
  store.close();
  store = new ProductionRuntimeStore(recoveryTemporary);
  const acceptedOnlyJob = {
    ...acceptedOnlyOriginalJob,
    lease_version: 2,
    lease_token: "lease:accepted-only:2",
    grant: {
      ...acceptedOnlyOriginalJob.grant,
      lease_version: 2,
      lease_token: "lease:accepted-only:2",
      execution_fence: {
        ...acceptedOnlyOriginalJob.grant.execution_fence,
        lease_version: 2,
        fence_hash: HASH_B,
      },
    },
  } as typeof acceptedOnlyOriginalJob;
  const acceptedOnlyBodies: Record<string, unknown>[] = [];
  let acceptedOnlyExecutions = 0;
  await executeClaim(recoveryRuntimeState({
    store, dataDir: recoveryTemporary, incident: { accepted: acceptedOnlyTask }, job: acceptedOnlyJob,
    abort: new AbortController(),
    session: recoverySession(acceptedOnlyJob, [acceptedOnlyReceipt], acceptedOnlyBodies),
    execute: async () => {
      acceptedOnlyExecutions += 1;
      throw executionFailure("failed", "TEST_ACCEPTED_ONLY_PRODUCT_FAILURE");
    },
  }), acceptedOnlyJob);
  assert.equal(acceptedOnlyExecutions, 1,
    "an exact accepted#1-only prefix must resume progress#2 and enter the Product execute boundary");
  assert.deepEqual(acceptedOnlyBodies.map((body) => [body.checkpoint_seq, body.checkpoint_kind]), [
    [2, "progress"],
    [3, "attempt_failure"],
  ]);
  assert.equal(store.readTask(acceptedOnlyTask.job_id)?.attempt_failure?.code,
    "TEST_ACCEPTED_ONLY_PRODUCT_FAILURE");

  const postSubmitTask = task({
    jobId: "job:recovery:post-submit", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const postSubmitOriginalJob = claimTask(postSubmitTask);
  const postSubmitAttemptId = postSubmitOriginalJob.grant.attempt_id;
  const postSubmitCheckpointBodies: Record<string, unknown>[] = [];
  const postSubmitReleaseBodies: Record<string, unknown>[] = [];
  await executeClaim(recoveryRuntimeState({
    store, dataDir: recoveryTemporary, incident: { accepted: postSubmitTask }, job: postSubmitOriginalJob,
    abort: new AbortController(),
    session: recoverySession(
      postSubmitOriginalJob, [], postSubmitCheckpointBodies, postSubmitReleaseBodies,
    ),
    execute: async () => {
      const terminalAt = new Date(Date.now() - 1_000).toISOString();
      throw postSubmitReadbackFault("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", {
        causeCode: "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE",
        exactCallIdentityHash: HASH_A,
        terminalAt,
        readbackDeadlineAt: new Date(Date.parse(terminalAt) + 3_600_000).toISOString(),
        evidenceRef: "gpt-call-evidence:submit",
        evidenceHash: HASH_B,
      });
    },
  }), postSubmitOriginalJob);
  assert.deepEqual(postSubmitCheckpointBodies.map((body) => [body.checkpoint_seq, body.checkpoint_kind]), [
    [1, "accepted"],
    [2, "progress"],
  ]);
  assert.equal(postSubmitReleaseBodies.length, 1);
  assert.equal(postSubmitReleaseBodies[0]?.reason_code, "POST_SUBMIT_READBACK_FAULT");
  assert.equal(
    (postSubmitReleaseBodies[0]?.confirmed_submit as Record<string, unknown>)?.outcome,
    "CONFIRMED",
  );
  assert.equal(
    (postSubmitReleaseBodies[0]?.confirmed_submit as Record<string, unknown>)?.readback_mutation_outcome,
    "no",
  );
  assert.equal(store.readTask(postSubmitTask.job_id)?.attempt_failure, null,
    "a confirmed-submit readback fault must release the lease without freezing attempt_failure");
  const expiredTerminalAt = new Date(Date.now() - 7_200_000).toISOString();
  for (const [code, terminalAt, readbackDeadlineAt] of [
    ["BROWSER_TARGET_INVALID", expiredTerminalAt,
      new Date(Date.parse(expiredTerminalAt) + 3_600_000).toISOString()],
    ["BROWSER_DOCUMENT_INVALID", new Date(Date.now() - 1_000).toISOString(),
      new Date(Date.now() + 3_599_000).toISOString()],
    ["BROWSER_DOM_CANDIDATE_MISSING", new Date(Date.now() - 1_000).toISOString(),
      new Date(Date.now() + 3_599_000).toISOString()],
    ["GPT_RESPONSE_STABILITY_TIMEOUT", new Date(Date.now() - 1_000).toISOString(),
      new Date(Date.now() + 3_599_000).toISOString()],
    ["GPT_RESPONSE_WAIT_ABORTED", new Date(Date.now() - 1_000).toISOString(),
      new Date(Date.now() + 3_599_000).toISOString()],
    ["GPT_RATE_LIMIT_ACTIVE", new Date(Date.now() - 1_000).toISOString(),
      new Date(Date.now() + 3_599_000).toISOString()],
  ] as const) {
    const preservedFailure = postSubmitReadbackFault(code, {
      causeCode: code,
      exactCallIdentityHash: HASH_A,
      terminalAt,
      readbackDeadlineAt,
      evidenceRef: `gpt-call-evidence:${code}`,
      evidenceHash: HASH_B,
    });
    assert.equal(postSubmitReadbackReceipt(preservedFailure)?.causeCode, code,
      `${code} must preserve the closed confirmed-submit receipt regardless of deadline age`);
  }
  const postSubmitReceipts = postSubmitCheckpointBodies.map((body) => checkpointReceipt(
    body as ReturnType<typeof recoveryCheckpointBody>, 1,
  ));
  store.close();
  store = new ProductionRuntimeStore(recoveryTemporary);
  const postSubmitReclaimedJob = {
    ...postSubmitOriginalJob,
    lease_version: 2,
    lease_token: "lease:post-submit:2",
    grant: {
      ...postSubmitOriginalJob.grant,
      lease_version: 2,
      lease_token: "lease:post-submit:2",
      execution_fence: {
        ...postSubmitOriginalJob.grant.execution_fence,
        lease_version: 2,
        fence_hash: HASH_B,
      },
    },
  } as typeof postSubmitOriginalJob;
  const postSubmitRestartBodies: Record<string, unknown>[] = [];
  let postSubmitRestartExecutions = 0;
  await executeClaim(recoveryRuntimeState({
    store, dataDir: recoveryTemporary, incident: { accepted: postSubmitTask }, job: postSubmitReclaimedJob,
    abort: new AbortController(),
    session: recoverySession(postSubmitReclaimedJob, postSubmitReceipts, postSubmitRestartBodies),
    execute: async () => {
      postSubmitRestartExecutions += 1;
      throw executionFailure("failed", "TEST_POST_SUBMIT_RESTART_PRODUCT_FAILURE");
    },
  }), postSubmitReclaimedJob);
  assert.equal(postSubmitRestartExecutions, 1);
  assert.deepEqual(postSubmitRestartBodies.map((body) => [body.checkpoint_seq, body.checkpoint_kind]), [
    [3, "progress"],
    [4, "attempt_failure"],
  ], "accepted#1/progress#2 must resume as progress#3 on the same attempt after restart");

  const continuingAccepted = task({
    jobId: "job:recovery:continuing", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const continuingOriginalJob = claimTask(continuingAccepted);
  const continuingAttemptId = continuingOriginalJob.grant.attempt_id;
  store.acceptTask(continuingAccepted, identityFor(continuingAccepted), continuingAttemptId);
  const continuingPath = `/internal/ai-production/v6/jobs/${encodeURIComponent(continuingAccepted.job_id)}/checkpoints`;
  const continuingReceipts = [
    recoveryCheckpointBody({
      jobId: continuingAccepted.job_id, attemptId: continuingAttemptId,
      requestId: "continuing:accepted:1", checkpointSeq: 1, checkpointKind: "accepted",
    }),
    recoveryCheckpointBody({
      jobId: continuingAccepted.job_id, attemptId: continuingAttemptId,
      requestId: "continuing:progress:2", checkpointSeq: 2, checkpointKind: "progress",
    }),
  ].map((body) => {
    const receipt = checkpointReceipt(body, 1);
    store.enqueue({
      idempotency_key: body.request_id, kind: "checkpoint", path: continuingPath,
      method: "POST", headers: {}, body: JSON.stringify(body),
    });
    store.markOutboxSent(body.request_id, receipt.response_json);
    return receipt;
  });
  store.close();
  store = new ProductionRuntimeStore(recoveryTemporary);
  const continuingJob = {
    ...continuingOriginalJob,
    lease_version: 2,
    lease_token: "lease:continuing:2",
    grant: {
      ...continuingOriginalJob.grant,
      lease_version: 2,
      lease_token: "lease:continuing:2",
      execution_fence: {
        ...continuingOriginalJob.grant.execution_fence,
        lease_version: 2,
        fence_hash: HASH_B,
      },
    },
  } as typeof continuingOriginalJob;
  const continuingBodies: Record<string, unknown>[] = [];
  let continuingExecutions = 0;
  const continuingState = recoveryRuntimeState({
    store, dataDir: recoveryTemporary, incident: { accepted: continuingAccepted }, job: continuingJob,
    abort: new AbortController(),
    session: recoverySession(continuingJob, continuingReceipts, continuingBodies),
    execute: async () => {
      continuingExecutions += 1;
      throw executionFailure("failed", "TEST_CONTINUING_PRODUCT_FAILURE");
    },
  });
  await executeClaim(continuingState, continuingJob);
  assert.equal(continuingExecutions, 1,
    "an exact normal accepted#1/progress#2 prefix must re-enter the Product execute boundary");
  assert.deepEqual(continuingBodies.map((body) => [body.checkpoint_seq, body.checkpoint_kind]), [
    [3, "progress"],
    [4, "attempt_failure"],
  ]);
  assert.equal(store.readTask(continuingAccepted.job_id)?.attempt_failure?.code,
    "TEST_CONTINUING_PRODUCT_FAILURE");

  const runtimeIncident = await seedRecoveryIncident(store, "runtime");
  store.recoverCheckpointPrefix({
    jobId: runtimeIncident.accepted.job_id,
    attemptId: runtimeIncident.attemptId,
    acceptedAttemptCount: 1,
    receipts: runtimeIncident.receipts,
  });
  assert.equal(store.readTask(runtimeIncident.accepted.job_id)?.attempt_failure, null,
    "the first process deletes the disproved false failure before progress#3");
  store.close();
  store = new ProductionRuntimeStore(recoveryTemporary);
  const runtimeJob = reclaimedJob(runtimeIncident);
  const checkpointBodies: Record<string, unknown>[] = [];
  const runtimeSession = recoverySession(runtimeJob, runtimeIncident.receipts, checkpointBodies);
  let executeCalls = 0;
  const runtimeAbort = new AbortController();
  const runtimeState = recoveryRuntimeState({
    store, dataDir: recoveryTemporary, incident: runtimeIncident, job: runtimeJob,
    abort: runtimeAbort, session: runtimeSession,
    execute: async () => {
      executeCalls += 1;
      throw executionFailure("failed", "TEST_PRODUCT_FAILURE");
    },
  });
  await executeClaim(runtimeState, runtimeJob);
  assert.equal(executeCalls, 1,
    "after restart the rejected Outbox rows must re-prove recovery without a persisted recovery projection");
  assert.deepEqual(checkpointBodies.map((body) => [body.checkpoint_seq, body.checkpoint_kind]), [
    [3, "progress"],
    [4, "attempt_failure"],
  ], "recovery must skip accepted#1, advance once to progress#3, then preserve the real Product failure");
  assert.equal(store.readTask(runtimeJob.job_id)?.attempt_failure?.code, "TEST_PRODUCT_FAILURE");

  const stoppedIncident = await seedRecoveryIncident(store, "runtime-stopped");
  const stoppedProgressBody = recoveryCheckpointBody({
    jobId: stoppedIncident.accepted.job_id,
    attemptId: stoppedIncident.attemptId,
    requestId: "runtime-stopped:progress:3",
    checkpointSeq: 3,
    checkpointKind: "progress",
  });
  const stoppedProgressReceipt = checkpointReceipt(stoppedProgressBody, 1);
  store.enqueue({
    idempotency_key: stoppedProgressBody.request_id,
    kind: "checkpoint",
    path: stoppedIncident.pathname,
    method: "POST",
    headers: {},
    body: JSON.stringify(stoppedProgressBody),
  });
  store.markOutboxSent(stoppedProgressBody.request_id, stoppedProgressReceipt.response_json);
  assert.equal(store.readTask(stoppedIncident.accepted.job_id)?.attempt_failure?.code,
    "AI_V6_CHECKPOINT_SEQUENCE_INVALID",
    "the recovered production shape starts with an active false-failure row and delivered progress#3");
  const stoppedReceipts = [...stoppedIncident.receipts, stoppedProgressReceipt];
  store.close();
  store = new ProductionRuntimeStore(recoveryTemporary);
  const stoppedJob = reclaimedJob(stoppedIncident);
  const stoppedBodies: Record<string, unknown>[] = [];
  const stoppedAbort = new AbortController();
  let executionStarted!: () => void;
  const started = new Promise<void>((resolve) => { executionStarted = resolve; });
  const stoppedState = recoveryRuntimeState({
    store, dataDir: recoveryTemporary, incident: stoppedIncident, job: stoppedJob,
    abort: stoppedAbort, session: recoverySession(stoppedJob, stoppedReceipts, stoppedBodies),
    execute: async (_task, _materials, budget) => {
      executionStarted();
      return new Promise<never>((_resolve, reject) => {
        const rejectAbort = () => reject(executionFailure("failed", "TEST_EXECUTION_ABORTED"));
        if (budget.abort_signal.aborted) rejectAbort();
        else budget.abort_signal.addEventListener("abort", rejectAbort, { once: true });
      });
    },
  });
  const stoppedClaim = executeClaim(stoppedState, stoppedJob);
  await started;
  stoppedAbort.abort("PRODUCTION_RUNTIME_STOPPED");
  await stoppedClaim;
  assert.deepEqual(stoppedBodies, [],
    "cursor#3 recovery must delete the false failure without emitting progress#4 or attempt_failure#4");
  assert.equal(store.readTask(stoppedJob.job_id)?.attempt_failure, null);
  const stoppedDatabase = Reflect.get(store, "database") as Database.Database;
  assert.equal(Number((stoppedDatabase.prepare(`select count(*) as count
    from production_attempt_failures where job_id=? and attempt_id=?`
  ).get(stoppedIncident.accepted.job_id, stoppedIncident.attemptId) as { count: number }).count), 0,
  "cursor#3 recovery must physically delete the exact false-failure row");
  assert.equal(
    store.readTask(stoppedJob.job_id)?.current_reason,
    "RUNTIME_RECOVERY_REQUIRED:PRODUCTION_RUNTIME_STOPPED",
  );
  store.close();
  store = new ProductionRuntimeStore(recoveryTemporary);
  const restartedJob = {
    ...stoppedJob,
    lease_version: 3,
    lease_token: `lease:${stoppedIncident.accepted.job_id}:3`,
    grant: {
      ...stoppedJob.grant,
      lease_version: 3,
      lease_token: `lease:${stoppedIncident.accepted.job_id}:3`,
      execution_fence: {
        ...stoppedJob.grant.execution_fence,
        lease_version: 3,
        fence_hash: HASH_A,
      },
    },
  } as typeof stoppedJob;
  const restartedBodies: Record<string, unknown>[] = [];
  let restartedExecutions = 0;
  const restartedState = recoveryRuntimeState({
    store, dataDir: recoveryTemporary, incident: stoppedIncident, job: restartedJob,
    abort: new AbortController(),
    session: recoverySession(restartedJob, stoppedReceipts, restartedBodies),
    execute: async () => {
      restartedExecutions += 1;
      throw executionFailure("failed", "TEST_PRODUCT_FAILURE_AFTER_SECOND_RESTART");
    },
  });
  await executeClaim(restartedState, restartedJob);
  assert.equal(restartedExecutions, 1);
  assert.deepEqual(restartedBodies.map((body) => [body.checkpoint_seq, body.checkpoint_kind]), [
    [4, "attempt_failure"],
  ], "a second restart must reuse delivered progress#3 and never emit progress#4");
  assert.equal(store.readTask(restartedJob.job_id)?.attempt_failure?.code,
    "TEST_PRODUCT_FAILURE_AFTER_SECOND_RESTART");
  store.close();
} finally {
  await rm(recoveryTemporary, { recursive: true, force: true });
}
