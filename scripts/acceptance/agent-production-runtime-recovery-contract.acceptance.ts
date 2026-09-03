import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import {
  checkpointProductionTask,
  downloadProductionMaterials,
} from "../../src/lib/local-runtime/production/cloud-client.js";
import { readProductionDeviceJobStatus } from "../../src/lib/local-runtime/production/cloud-reconciliation-client.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { executionFailure } from "../../src/lib/execution-failure.js";
import {
  runtimeTransportFailure,
  typedRuntimeTransportFailure,
} from "../../src/lib/local-runtime/production/transport-failure.js";
import { assertPermanentRevocationSettlement } from "./agent-production-runtime-permanent-revocation-support.js";
import {
  HASH_A,
  HASH_B,
  claimTask,
  identityFor,
  recoveryCheckpointBody,
  recoveryCheckpointReceipt as checkpointReceipt,
  recoveryRemoteStatus as remoteStatus,
  seedRecoveryIncident,
  task,
} from "./agent-production-runtime-fixtures.js";

const parsed = await readProductionDeviceJobStatus({
  request: async () => remoteStatus(),
}, "job:recovery-parser");
assert.equal(parsed.accepted_attempt_count, 7);
assert.equal("accepted_attempt_limit" in remoteStatus(), false,
  "the V13 Website fixture must not expose an accepted-attempt limit");
assert.equal("accepted_attempt_limit" in parsed, false,
  "the AGENT consumes attempt count as a fact without importing Website retry policy");
assert.equal("attempt_authority" in parsed, false,
  "the AGENT must not depend on an undeclared Website attempt projection");
assert.equal(parsed.control_intent.intent, "none");

const materialFailureTemporary = await mkdtemp(path.join(tmpdir(), "agent-material-failure-"));
const originalMaterialFetch = globalThis.fetch;
try {
  globalThis.fetch = (async () => new Response(JSON.stringify({
    ok: false,
    error: { code: "AI_PRODUCTION_INPUT_OBJECT_READ_FAILED", message: "Input object is unavailable." },
  }), { status: 503, headers: { "content-type": "application/problem+json" } })) as typeof globalThis.fetch;
  const materialJob = claimTask(task({
    jobId: "job:material-remote-failure",
    productId: "payment_screenshot_observation",
    actionId: "observe",
    materialRefs: [{
      material_id: "material:remote-failure", ordinal: 0, role: "payment_screenshot",
      display_name: "payment.png", object_ref: "object:payment", sha256: HASH_A,
      bytes: 10, media_type: "image/png", storage_class: "private_owner_scoped",
      owner_scope_hash: HASH_B, trust_class: "user_provided_data", may_issue_instruction: false,
    }],
    extra: { parameters: { observation_schema_version: "payment-screenshot-observation-v1" } },
  }));
  await assert.rejects(downloadProductionMaterials({
    device: { server_base_url: "https://website.example" }, authorizationHeaders: async () => ({}),
  } as never, materialJob, materialFailureTemporary), (error: unknown) => {
    const failure = typedRuntimeTransportFailure(error);
    return failure?.code === "AI_PRODUCTION_INPUT_OBJECT_READ_FAILED" && failure.httpStatus === 503;
  }, "material download must preserve the Website problem code and HTTP status");
} finally {
  globalThis.fetch = originalMaterialFetch;
  await rm(materialFailureTemporary, { recursive: true, force: true });
}

const revokedStatus = await readProductionDeviceJobStatus({
  request: async () => ({
    ...remoteStatus(),
    current_reason: { code: "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED" },
    control_intent: {
      schema_version: "xuanxue-ai-control-intent.v6",
      job_id: "job:recovery-parser",
      intent: "cancel_requested",
      control_epoch: 2,
      reason_code: "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED",
    },
  }),
}, "job:recovery-parser");
assert.equal(revokedStatus.control_intent.reason_code, "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED");
await assert.rejects(() => readProductionDeviceJobStatus({
  request: async () => ({
    ...remoteStatus(),
    current_reason: { code: "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED" },
  }),
}, "job:recovery-parser"), /V6_DEVICE_JOB_CONTROL_AUTHORITY_INVALID/u,
"a current reason without the matching control intent must never authorize local settlement");
await assert.rejects(() => readProductionDeviceJobStatus({
  request: async () => ({ ...remoteStatus(), control_intent: null }),
}, "job:recovery-parser"), /V6_DEVICE_JOB_CONTROL_AUTHORITY_INVALID/u,
"a malformed control projection must fail with a typed authority error");

const admissionPending = await readProductionDeviceJobStatus({
  request: async () => ({
    ...remoteStatus(), status: "failed", terminal_status: "completed", terminal_payload_hash: HASH_A,
    current_reason: { code: "PUBLIC_KNOWLEDGE_ADMISSION_WRITE_FAILED" },
    business_consumer_error: "PUBLIC_KNOWLEDGE_ADMISSION_WRITE_FAILED",
  }),
}, "job:recovery-parser");
assert.equal(admissionPending.terminal_status, "completed");
assert.equal(admissionPending.business_admission_receipt, null,
  "a staged terminal result without a Website admission receipt remains legally unfinished");

await assert.rejects(() => readProductionDeviceJobStatus({
  request: async () => ({
    ...remoteStatus(), status: "completed", terminal_status: "completed", terminal_payload_hash: HASH_A,
  }),
}, "job:recovery-parser"), /V6_BUSINESS_ADMISSION_AUTHORITY_INVALID/u,
"Website completed without its business admission receipt must fail closed");

await assert.rejects(() => readProductionDeviceJobStatus({
  request: async () => ({
    ...remoteStatus(), terminal_status: "completed", terminal_payload_hash: null,
  }),
}, "job:recovery-parser"), /V6_DEVICE_JOB_TERMINAL_AUTHORITY_INVALID/u,
"a terminal result without its payload hash must fail closed");

await assert.rejects(() => readProductionDeviceJobStatus({
  request: async () => ({ ...remoteStatus(), accepted_attempt_count: -1 }),
}, "job:recovery-parser"), /V6_DEVICE_JOB_STATUS_INVALID/u);
await assert.rejects(() => readProductionDeviceJobStatus({
  request: async () => ({ ...remoteStatus(), accepted_attempt_count: 1.5 }),
}, "job:recovery-parser"), /V6_DEVICE_JOB_STATUS_INVALID/u);
await assert.rejects(() => readProductionDeviceJobStatus({
  request: async () => remoteStatus([{
    request_id: "receipt:invalid", write_kind: "checkpoint", payload_hash: "not-a-hash", response_json: {},
  }]),
}, "job:recovery-parser"), /V6_DEVICE_JOB_STATUS_INVALID/u);
await assert.rejects(() => readProductionDeviceJobStatus({
  request: async () => remoteStatus([{
    request_id: "receipt:unknown-kind", write_kind: "unknown", payload_hash: HASH_A, response_json: {},
  }]),
}, "job:recovery-parser"), /V6_DEVICE_JOB_STATUS_INVALID/u);

const checkpointTemporary = await mkdtemp(path.join(tmpdir(), "agent-production-recovery-"));
try {
  const store = new ProductionRuntimeStore(checkpointTemporary);
  const accepted = task({
    jobId: "job:checkpoint-cursor", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const job = claimTask(accepted);
  store.acceptTask(accepted, identityFor(accepted), job.grant.attempt_id);
  let observedBody: Record<string, unknown> = {};
  const session = {
    workerSessionId: job.grant.worker_session_id,
    workerSessionEpoch: job.grant.worker_session_epoch,
    request: async (_pathname: string, init: { body?: string }) => {
      observedBody = JSON.parse(init.body ?? "{}") as Record<string, unknown>;
      return {
        job_id: job.job_id,
        checkpoint_seq: observedBody.checkpoint_seq,
        checkpoint_hash: hashCanonical(observedBody),
      };
    },
  };
  const progress = await checkpointProductionTask(session, store, job, "progress", 3);
  assert.equal(observedBody?.checkpoint_seq, 3);
  assert.equal(observedBody?.checkpoint_kind, "progress");
  assert.equal(progress.checkpointSeq, 3);
  assert.equal(progress.checkpointHash, hashCanonical(observedBody));

  let rejectedCalls = 0;
  const rejectingSession = {
    workerSessionId: job.grant.worker_session_id,
    workerSessionEpoch: job.grant.worker_session_epoch,
    request: async () => {
      rejectedCalls += 1;
      throw runtimeTransportFailure("AI_V6_CHECKPOINT_SEQUENCE_INVALID", 409);
    },
  };
  await assert.rejects(
    checkpointProductionTask(rejectingSession, store, job, "progress", 4),
    /AI_V6_CHECKPOINT_SEQUENCE_INVALID/u,
  );
  const nextLease = {
    ...job,
    lease_version: 2,
    grant: {
      ...job.grant,
      lease_version: 2,
      execution_fence: { ...job.grant.execution_fence, lease_version: 2, fence_hash: HASH_B },
    },
  } as typeof job;
  await assert.rejects(
    checkpointProductionTask(rejectingSession, store, nextLease, "progress", 4),
    /AI_V6_CHECKPOINT_SEQUENCE_INVALID/u,
  );
  assert.equal(rejectedCalls, 1, "the same rejected logical checkpoint must not amplify across leases");
  const database = Reflect.get(store, "database") as Database.Database;
  assert.equal(Number((database.prepare(`select count(*) as count from production_outbox
    where json_extract(cast(body_blob as text),'$.checkpoint_seq')=4`
  ).get() as { count: number }).count), 1);
  store.close();
} finally {
  await rm(checkpointTemporary, { recursive: true, force: true });
}

const recoveryTemporary = await mkdtemp(path.join(tmpdir(), "agent-production-prefix-proof-"));
try {
  const store = new ProductionRuntimeStore(recoveryTemporary);
  const database = Reflect.get(store, "database") as Database.Database;
  const positive = await seedRecoveryIncident(store, "positive", 19);
  const prefix = store.recoverCheckpointPrefix({
    jobId: positive.accepted.job_id,
    attemptId: positive.attemptId,
    acceptedAttemptCount: 1,
    receipts: [...positive.receipts, {
      request_id: "positive:renew", write_kind: "renew", payload_hash: HASH_A, response_json: {},
    }],
  });
  assert.equal(prefix.checkpointSeq, 2);
  assert.equal(prefix.checkpointHash, positive.receipts[1]!.payload_hash);
  assert.deepEqual(store.recoverCheckpointPrefix({
    jobId: positive.accepted.job_id, attemptId: positive.attemptId, acceptedAttemptCount: 1,
    receipts: positive.receipts,
  }), prefix, "the exact 19-pair authority proof is idempotent before progress#3");
  assert.equal(store.readTask(positive.accepted.job_id)?.attempt_failure, null);
  assert.equal(Number((database.prepare(`select count(*) as count
    from production_attempt_failures where job_id=? and attempt_id=?`
  ).get(positive.accepted.job_id, positive.attemptId) as { count: number }).count), 0,
  "the exact false-failure row must be physically deleted after remote rejection and Outbox proof");

  const emptyPrefixBase = await seedRecoveryIncident(store, "empty-prefix");
  store.recoverCheckpointPrefix({
    jobId: emptyPrefixBase.accepted.job_id,
    attemptId: emptyPrefixBase.attemptId,
    acceptedAttemptCount: 1,
    receipts: emptyPrefixBase.receipts,
  });
  const nextAttemptId = "attempt:empty-prefix:2";
  store.acceptTask(emptyPrefixBase.accepted, identityFor(emptyPrefixBase.accepted), nextAttemptId);
  assert.deepEqual(store.recoverCheckpointPrefix({
    jobId: emptyPrefixBase.accepted.job_id,
    attemptId: nextAttemptId,
    acceptedAttemptCount: 2,
    receipts: emptyPrefixBase.receipts,
  }), { checkpointSeq: 0, checkpointHash: null },
  "a durably accepted new attempt with no checkpoint intent must resume from the empty prefix");

  const noRejectedIncident = await seedRecoveryIncident(store, "no-rejected-incident");
  database.prepare(`delete from production_outbox where path like ? and sent_at is null`).run(
    `%/jobs/${encodeURIComponent(noRejectedIncident.accepted.job_id)}/%`,
  );
  assert.throws(() => store.recoverCheckpointPrefix({
    jobId: noRejectedIncident.accepted.job_id,
    attemptId: noRejectedIncident.attemptId,
    acceptedAttemptCount: 1,
    receipts: noRejectedIncident.receipts,
  }), /PRODUCTION_RECOVERY_REJECTED_INCIDENT_MISSING/u);
  assert.deepEqual(
    store.readTask(noRejectedIncident.accepted.job_id)?.attempt_failure,
    noRejectedIncident.falseFailure,
    "delivered checkpoints alone must not delete a failure without the exact rejected incident",
  );

  const activeProgress3 = await seedRecoveryIncident(store, "active-progress-3");
  const activeProgress3Body = recoveryCheckpointBody({
    jobId: activeProgress3.accepted.job_id,
    attemptId: activeProgress3.attemptId,
    requestId: "active-progress-3:progress:3",
    checkpointSeq: 3,
    checkpointKind: "progress",
  });
  const activeProgress3Receipt = checkpointReceipt(activeProgress3Body, 1);
  store.enqueue({
    idempotency_key: activeProgress3Body.request_id,
    kind: "checkpoint",
    path: activeProgress3.pathname,
    method: "POST",
    headers: {},
    body: JSON.stringify(activeProgress3Body),
  });
  store.markOutboxSent(activeProgress3Body.request_id, activeProgress3Receipt.response_json);
  const activeProgress3Receipts = [...activeProgress3.receipts, activeProgress3Receipt];
  const activeProgress3Cursor = store.recoverCheckpointPrefix({
    jobId: activeProgress3.accepted.job_id,
    attemptId: activeProgress3.attemptId,
    acceptedAttemptCount: 1,
    receipts: activeProgress3Receipts,
  });
  assert.equal(activeProgress3Cursor.checkpointSeq, 3);
  assert.equal(store.readTask(activeProgress3.accepted.job_id)?.attempt_failure, null);
  assert.deepEqual(store.recoverCheckpointPrefix({
    jobId: activeProgress3.accepted.job_id,
    attemptId: activeProgress3.attemptId,
    acceptedAttemptCount: 1,
    receipts: activeProgress3Receipts,
  }), activeProgress3Cursor,
  "a second restart must re-prove cursor#3 from receipts and Outbox without progress#4");

  const progressed = await seedRecoveryIncident(store, "progressed");
  store.recoverCheckpointPrefix({
    jobId: progressed.accepted.job_id, attemptId: progressed.attemptId, acceptedAttemptCount: 1,
    receipts: progressed.receipts,
  });
  const progressedBody = recoveryCheckpointBody({
    jobId: progressed.accepted.job_id, attemptId: progressed.attemptId,
    requestId: "progressed:progress:3", checkpointSeq: 3, checkpointKind: "progress",
  });
  const progressedReceipt = checkpointReceipt(progressedBody, 1);
  store.enqueue({
    idempotency_key: progressedBody.request_id, kind: "checkpoint", path: progressed.pathname,
    method: "POST", headers: {}, body: JSON.stringify(progressedBody),
  });
  store.markOutboxSent(progressedBody.request_id, progressedReceipt.response_json);
  const progressedCursor = store.recoverCheckpointPrefix({
    jobId: progressed.accepted.job_id, attemptId: progressed.attemptId, acceptedAttemptCount: 1,
    receipts: [...progressed.receipts, progressedReceipt],
  });
  assert.equal(progressedCursor.checkpointSeq, 3);
  assert.equal(progressedCursor.checkpointHash, progressedReceipt.payload_hash);
  for (const body of [
    recoveryCheckpointBody({
      jobId: positive.accepted.job_id, attemptId: positive.attemptId,
      requestId: "positive:extra-rejected:accepted:1", checkpointSeq: 1, checkpointKind: "accepted",
    }),
    recoveryCheckpointBody({
      jobId: positive.accepted.job_id, attemptId: positive.attemptId,
      requestId: "positive:extra-rejected:failure:2", checkpointSeq: 2,
      checkpointKind: "attempt_failure", attemptFailure: positive.falseFailure,
    }),
  ]) {
    store.enqueue({
      idempotency_key: body.request_id, kind: "checkpoint", path: positive.pathname,
      method: "POST", headers: {}, body: JSON.stringify(body),
    });
    await assert.rejects(store.deliverOutbox(body.request_id, async () => {
      throw runtimeTransportFailure("AI_V6_CHECKPOINT_SEQUENCE_INVALID", 409);
    }), /AI_V6_CHECKPOINT_SEQUENCE_INVALID/u);
  }
  assert.equal(store.recoverCheckpointPrefix({
    jobId: positive.accepted.job_id, attemptId: positive.attemptId, acceptedAttemptCount: 1,
    receipts: positive.receipts,
  }).checkpointSeq, 2,
  "recovery must re-prove the exact prefix from remote receipts and every deterministic rejected Outbox row");

  const duplicate = await seedRecoveryIncident(store, "duplicate");
  assert.throws(() => store.recoverCheckpointPrefix({
    jobId: duplicate.accepted.job_id, attemptId: duplicate.attemptId, acceptedAttemptCount: 1,
    receipts: [duplicate.receipts[0]!, duplicate.receipts[0]!, duplicate.receipts[1]!],
  }), /PRODUCTION_RECOVERY_RECEIPT_AMBIGUOUS/u);

  const missing = await seedRecoveryIncident(store, "missing");
  assert.throws(() => store.recoverCheckpointPrefix({
    jobId: missing.accepted.job_id, attemptId: missing.attemptId, acceptedAttemptCount: 1,
    receipts: [missing.receipts[0]!],
  }), /PRODUCTION_RECOVERY_REMOTE_RECEIPT_MISSING/u);

  const oldOnly = await seedRecoveryIncident(store, "old-attempt-only");
  const oldReceipts = [
    recoveryCheckpointBody({
      jobId: oldOnly.accepted.job_id, attemptId: "attempt:old",
      requestId: "old-attempt-only:old:accepted:1", checkpointSeq: 1, checkpointKind: "accepted",
    }),
    recoveryCheckpointBody({
      jobId: oldOnly.accepted.job_id, attemptId: "attempt:old",
      requestId: "old-attempt-only:old:progress:2", checkpointSeq: 2, checkpointKind: "progress",
    }),
  ].map((body) => {
    const receipt = checkpointReceipt(body, 1);
    store.enqueue({
      idempotency_key: body.request_id, kind: "checkpoint", path: oldOnly.pathname,
      method: "POST", headers: {}, body: JSON.stringify(body),
    });
    store.markOutboxSent(body.request_id, receipt.response_json);
    return receipt;
  });
  assert.throws(() => store.recoverCheckpointPrefix({
    jobId: oldOnly.accepted.job_id, attemptId: oldOnly.attemptId, acceptedAttemptCount: 1,
    receipts: oldReceipts,
  }), /PRODUCTION_RECOVERY_REMOTE_RECEIPT_MISSING/u,
  "old-attempt receipts are verified but can never authorize the current cursor");

  const innerHash = await seedRecoveryIncident(store, "inner-hash");
  const innerBody = JSON.parse((database.prepare(`select cast(body_blob as text) as body
    from production_outbox where idempotency_key=?`).get(
    innerHash.receipts[1]!.request_id,
  ) as { body: string }).body) as Record<string, unknown>;
  assert.throws(() => store.recoverCheckpointPrefix({
    jobId: innerHash.accepted.job_id, attemptId: innerHash.attemptId, acceptedAttemptCount: 1,
    receipts: [innerHash.receipts[0]!, { ...innerHash.receipts[1]!,
      payload_hash: innerBody.payload_hash as `sha256:${string}` }],
  }), /PRODUCTION_REMOTE_RECEIPT_PAYLOAD_MISMATCH/u,
  "the inner checkpoint payload hash must not substitute for the full-body receipt hash");

  const responseMismatch = await seedRecoveryIncident(store, "response-mismatch");
  assert.throws(() => store.recoverCheckpointPrefix({
    jobId: responseMismatch.accepted.job_id,
    attemptId: responseMismatch.attemptId,
    acceptedAttemptCount: 1,
    receipts: [responseMismatch.receipts[0]!, {
      ...responseMismatch.receipts[1]!,
      response_json: { ...responseMismatch.receipts[1]!.response_json, checkpoint_seq: 3 },
    }],
  }), /PRODUCTION_OUTBOX_RESPONSE_CONFLICT/u);

  const localResponseDrift = await seedRecoveryIncident(store, "local-response-drift");
  database.prepare("update production_outbox set response_json=? where idempotency_key=?").run(
    JSON.stringify({ ...localResponseDrift.receipts[1]!.response_json, checkpoint_seq: 99 }),
    localResponseDrift.receipts[1]!.request_id,
  );
  assert.throws(() => store.recoverCheckpointPrefix({
    jobId: localResponseDrift.accepted.job_id,
    attemptId: localResponseDrift.attemptId,
    acceptedAttemptCount: 1,
    receipts: localResponseDrift.receipts,
  }), /PRODUCTION_OUTBOX_RESPONSE_CONFLICT/u,
  "a local response body whose canonical hash no longer matches its stored hash must fail closed");

  const localResponseInvalid = await seedRecoveryIncident(store, "local-response-invalid");
  database.prepare("update production_outbox set response_json=? where idempotency_key=?").run(
    "{invalid-json",
    localResponseInvalid.receipts[1]!.request_id,
  );
  assert.throws(() => store.recoverCheckpointPrefix({
    jobId: localResponseInvalid.accepted.job_id,
    attemptId: localResponseInvalid.attemptId,
    acceptedAttemptCount: 1,
    receipts: localResponseInvalid.receipts,
  }), /PRODUCTION_OUTBOX_RESPONSE_CONFLICT/u,
  "an unparsable local response body must fail closed before recovery");

  const resultPrefix = await seedRecoveryIncident(store, "result-prefix");
  assert.throws(() => store.recoverCheckpointPrefix({
    jobId: resultPrefix.accepted.job_id, attemptId: resultPrefix.attemptId, acceptedAttemptCount: 1,
    receipts: [...resultPrefix.receipts, {
      request_id: "result-prefix:artifact", write_kind: "artifact", payload_hash: HASH_A, response_json: {},
    }],
  }), /PRODUCTION_RECOVERY_RESULT_WRITE_PRESENT/u);

  const higher = await seedRecoveryIncident(store, "higher-sequence");
  const higherBody = recoveryCheckpointBody({
    jobId: higher.accepted.job_id, attemptId: higher.attemptId,
    requestId: "higher-sequence:progress:4", checkpointSeq: 4, checkpointKind: "progress",
  });
  const higherReceipt = checkpointReceipt(higherBody, 1);
  store.enqueue({
    idempotency_key: higherBody.request_id, kind: "checkpoint", path: higher.pathname,
    method: "POST", headers: {}, body: JSON.stringify(higherBody),
  });
  store.markOutboxSent(higherBody.request_id, higherReceipt.response_json);
  assert.throws(() => store.recoverCheckpointPrefix({
    jobId: higher.accepted.job_id, attemptId: higher.attemptId, acceptedAttemptCount: 1,
    receipts: [...higher.receipts, higherReceipt],
  }), /PRODUCTION_RECOVERY_CHECKPOINT_PREFIX_INVALID/u);

  const pendingHigher = await seedRecoveryIncident(store, "pending-higher-sequence");
  const pendingHigherBody = recoveryCheckpointBody({
    jobId: pendingHigher.accepted.job_id, attemptId: pendingHigher.attemptId,
    requestId: "pending-higher-sequence:progress:3", checkpointSeq: 3, checkpointKind: "progress",
  });
  store.enqueue({
    idempotency_key: pendingHigherBody.request_id, kind: "checkpoint", path: pendingHigher.pathname,
    method: "POST", headers: {}, body: JSON.stringify(pendingHigherBody),
  });
  assert.throws(() => store.recoverCheckpointPrefix({
    jobId: pendingHigher.accepted.job_id, attemptId: pendingHigher.attemptId, acceptedAttemptCount: 1,
    receipts: pendingHigher.receipts,
  }), /PRODUCTION_RECOVERY_LOCAL_PREFIX_INVALID/u);

  const rejectedHigher = await seedRecoveryIncident(store, "rejected-higher-sequence");
  const rejectedHigherBody = recoveryCheckpointBody({
    jobId: rejectedHigher.accepted.job_id, attemptId: rejectedHigher.attemptId,
    requestId: "rejected-higher-sequence:progress:3", checkpointSeq: 3, checkpointKind: "progress",
  });
  store.enqueue({
    idempotency_key: rejectedHigherBody.request_id, kind: "checkpoint", path: rejectedHigher.pathname,
    method: "POST", headers: {}, body: JSON.stringify(rejectedHigherBody),
  });
  await assert.rejects(store.deliverOutbox(rejectedHigherBody.request_id, async () => {
    throw runtimeTransportFailure("AI_V6_CHECKPOINT_SEQUENCE_INVALID", 409);
  }), /AI_V6_CHECKPOINT_SEQUENCE_INVALID/u);
  assert.throws(() => store.recoverCheckpointPrefix({
    jobId: rejectedHigher.accepted.job_id, attemptId: rejectedHigher.attemptId, acceptedAttemptCount: 1,
    receipts: rejectedHigher.receipts,
  }), /PRODUCTION_RECOVERY_LOCAL_PREFIX_INVALID/u);

  const scheduledRejected = await seedRecoveryIncident(store, "scheduled-rejected");
  assert.ok(store.readOutboxAuthority("scheduled-rejected:rejected:accepted:1")?.nextDeliveryAt);
  assert.equal(store.recoverCheckpointPrefix({
    jobId: scheduledRejected.accepted.job_id,
    attemptId: scheduledRejected.attemptId,
    acceptedAttemptCount: 1,
    receipts: scheduledRejected.receipts,
  }).checkpointSeq, 2,
  "a retry-scheduled deterministic rejection remains exact proof while the same intent stays pending");
  store.close();
} finally {
  await rm(recoveryTemporary, { recursive: true, force: true });
}

await assertPermanentRevocationSettlement();
