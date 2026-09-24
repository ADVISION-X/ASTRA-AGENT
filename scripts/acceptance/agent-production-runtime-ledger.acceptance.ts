import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { executionFailure, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { hashCanonical, sha256 } from "../../src/lib/local-runtime/production/contracts.js";
import { resolveStoredProductionAuthority } from
  "../../src/lib/local-runtime/production/store-authority-reader.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { ProviderRateLimitControl } from
  "../../src/lib/local-runtime/production/provider-rate-limit-control.js";
import { buildProductionLeaseRelease } from
  "../../src/lib/local-runtime/production/cloud-client.js";
import { parseProviderCooldownReceipt } from
  "../../src/lib/local-runtime/production/provider-cooldown-receipt.js";
import {
  serializeTerminalFailure,
} from "../../src/lib/local-runtime/production/terminal-failure.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import {
  HASH_A, HASH_B, attemptFailureFirstFact, claimTask, resultFor, task,
} from "./agent-production-runtime-fixtures.js";
import { verifyBrowserFailureStoreContract } from
  "./agent-production-runtime-browser-failure-store.acceptance-support.js";

const temporary = await mkdtemp(path.join(tmpdir(), "agent-production-ledger-"));
const tableNames = (database: Database.Database): string[] =>
  (database.prepare(`select name from sqlite_master where type='table' and name like 'production_%'
    order by name`).all() as Array<{ name: string }>).map((row) => row.name);
const columns = (database: Database.Database, table: string): string[] =>
  (database.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name);

try {
  const dataDirectory = path.join(temporary, "two-table-store");
  await mkdir(dataDirectory);
  const store = new ProductionRuntimeStore(dataDirectory);
  const database = Reflect.get(store, "database") as Database.Database;
  assert.deepEqual(tableNames(database), [
    "production_attempt_handoffs", "production_outbox", "production_tasks",
  ]);
  assert.equal(columns(database, "production_tasks").includes("attempt_failure_json"), true);
  assert.equal(tableNames(database).includes("production_attempt_failures"), false);
  assert.equal(tableNames(database).includes("production_checkpoints"), false);
  assert.equal(tableNames(database).includes("production_continuations"), false);

  const accepted = task({
    jobId: "job:three-truths", productId: "payment_screenshot_observation", actionId: "observe",
  });
  const firstAttempt = "attempt:three-truths:1";
  store.acceptTask(accepted, firstAttempt);
  store.markExecuting(accepted.job_id);
  const legacyFailure = serializeTerminalFailure(executionFailure("failed", "PROVIDER_REJECTED"));
  assert.throws(() => store.recordAttemptFailure(
    accepted.job_id, firstAttempt, legacyFailure as never,
  ), /PRODUCTION_ATTEMPT_FAILURE_INVALID/u,
  "the removed 11-key attempt failure shape must not remain a persistence compatibility path");
  const firstFailure = attemptFailureFirstFact(firstAttempt, legacyFailure);
  store.recordAttemptFailure(accepted.job_id, firstAttempt, firstFailure);
  store.recordAttemptFailure(accepted.job_id, firstAttempt, firstFailure);
  assert.deepEqual(store.readTask(accepted.job_id)?.attempt_failure, firstFailure);
  assert.throws(() => store.completeTask(accepted.job_id, resultFor(accepted)),
    /PRODUCTION_TASK_COMPLETION_CONFLICT/u,
    "a task with a surviving first failure fact must never become completed");
  const releaseClaim = claimTask(task({
    jobId: "job:release-builder", productId: "payment_screenshot_observation", actionId: "observe",
  }));
  const releaseCore = attemptFailureFirstFact(releaseClaim.grant.attempt_id, legacyFailure).failure_core;
  const builtRelease = buildProductionLeaseRelease({
    workerSessionId: releaseClaim.grant.worker_session_id,
    workerSessionEpoch: releaseClaim.grant.worker_session_epoch,
  } as never, releaseClaim, { reasonCode: "ATTEMPT_FAILED", attemptFailure: releaseCore });
  assert.equal(builtRelease.descriptor.body_payload_hash, builtRelease.request.payload_hash);
  assert.equal(builtRelease.descriptor.write_request_payload_hash, hashCanonical(builtRelease.request));
  assert.equal(builtRelease.descriptor.request_id, builtRelease.request.request_id);
  verifyBrowserFailureStoreContract(store);
  assert.throws(() => store.recordAttemptFailure(
    accepted.job_id,
    firstAttempt,
    attemptFailureFirstFact(firstAttempt,
      serializeTerminalFailure(executionFailure("failed", "DIFFERENT_FAILURE"))),
  ), /PRODUCTION_ATTEMPT_FAILURE_IMMUTABLE/u);

  const secondAttempt = "attempt:three-truths:2";
  assert.throws(() => store.acceptTask(accepted, firstAttempt),
    /PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_REQUIRED/u);
  assert.deepEqual(store.acceptTaskAfterFailureReconciled(
    accepted, firstAttempt, firstFailure,
  ).attempt_failure, firstFailure,
  "a reconciled same-attempt regrant must preserve the first failure fact");
  assert.throws(() => store.acceptTask(accepted, secondAttempt),
    /PRODUCTION_SOURCE_HANDOFF_REQUIRED/u);
  assert.throws(() => store.acceptTaskAfterFailureReconciled(
    accepted, secondAttempt, firstFailure,
  ), /PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_CONFLICT/u,
  "old failure reconciliation cannot accept a different attempt");
  const partialKey = "artifact:three-truths:partial-before-handoff";
  store.enqueue({ idempotency_key: partialKey, kind: "artifact",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(accepted.job_id)}/artifacts/generated_image/partial`,
    method: "PUT", headers: {}, body: Buffer.from("partial") });
  const immutableOutbox = store.readResultOutboxHistoryEvidence(accepted.job_id, firstAttempt);
  const sourceBody = {
    kind: "attempt_handoff" as const,
    job_id: accepted.job_id,
    source_attempt_id: firstAttempt,
    source_task_hash: hashCanonical(accepted),
    first_fact_raw_hash: sha256(Buffer.from(store.readAttemptFailureRaw(accepted.job_id)!, "utf8")),
    outbox_history_hash: immutableOutbox.historyHash,
    outbox_candidate_count: immutableOutbox.candidateCount,
    payload_slot_conflict: null,
    browser_history_hash: HASH_B,
    browser_row_count: 0,
    browser_input_state: "zero" as const,
    browser_target_settled: true,
    target_settlement_hash: HASH_A,
    readback_exhaustion_hash: null,
    replay_calls: [],
    rejected_call: null,
    readback_proofs: [],
  };
  const sourceSeal = hashCanonical(sourceBody);
  store.sealSourceHandoff({ ...sourceBody, seal_hash: sourceSeal });
  store.markOutboxSent(partialKey, { receipt_hash: HASH_A });
  assert.equal(store.readResultOutboxHistoryEvidence(accepted.job_id, firstAttempt).historyHash,
    immutableOutbox.historyHash,
  "transport receipt timing cannot change a sealed source history hash");
  assert.equal(store.readSealedSourceHandoff(accepted.job_id, firstAttempt)?.seal_hash, sourceSeal);
  const second = store.acceptTaskAfterSourceHandoff(accepted, secondAttempt, sourceSeal);
  assert.equal(second.current_attempt_id, secondAttempt);
  assert.equal(second.attempt_failure, null);
  assert.equal(store.acceptTask(accepted, secondAttempt).current_reason, "LEASE_REGRANTED");

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
  const taskJson = database.prepare("select task_json from production_tasks where job_id=?")
    .pluck().get(accepted.job_id) as string;
  database.prepare("update production_tasks set task_json='{' where job_id=?").run(accepted.job_id);
  assert.throws(() => store.assertStartupDataIntegrity(),
    (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_TASK_AUTHORITY_CORRUPT");
  database.prepare("update production_tasks set task_json=? where job_id=?").run(taskJson, accepted.job_id);
  const sentAt = database.prepare("select sent_at from production_outbox where idempotency_key=?")
    .pluck().get(artifactKey) as string;
  database.prepare("update production_outbox set sent_at=null where idempotency_key=?").run(artifactKey);
  assert.throws(() => store.assertStartupDataIntegrity(),
    (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_STATE_INVARIANT_INVALID");
  database.prepare("update production_outbox set sent_at=? where idempotency_key=?").run(sentAt, artifactKey);
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
  const cleanProviderControl = new ProviderRateLimitControl(store, {
    device: { device_id: "device-1" },
  } as never);
  cleanProviderControl.observeWebsiteAuthority({
    serverNow: "2030-01-01T00:00:00.000Z", reasonCodes: [],
  });
  assert.doesNotThrow(() => cleanProviderControl.assertProviderSubmitAllowed(),
    "normal Website authority must keep submit open when no provider cooldown history exists");
  cleanProviderControl.observeWebsiteAuthority({
    serverNow: "2030-01-01T00:00:01.000Z",
    reasonCodes: ["PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE"],
  });
  assert.throws(() => cleanProviderControl.assertProviderSubmitAllowed(),
    /PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE/u,
    "an active Website cooldown reason must close submit even without local incident history");
  cleanProviderControl.observeWebsiteAuthority({
    serverNow: "2030-01-01T00:00:02.000Z",
    reasonCodes: ["PROVIDER_RATE_LIMIT_CLEARANCE_PENDING"],
  });
  assert.throws(() => cleanProviderControl.assertProviderSubmitAllowed(),
    /PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE/u,
    "Website clearance_pending must close submit even without local incident history");
  const cooldownKey = "aipcooldown_0123456789abcdef0123456789abcdef01234567";
  store.enqueue({
    idempotency_key: cooldownKey,
    kind: "provider_cooldown",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(accepted.job_id)}/provider-cooldown`,
    method: "POST",
    headers: { "x-ai-execution-fence-hash": HASH_A },
    body: JSON.stringify({ schema_version: "xuanxue-ai-provider-cooldown-notice.v6",
      request_id: cooldownKey, incident_request_id: cooldownKey, phase: "incident",
      job_id: accepted.job_id, attempt_id: secondAttempt, result_revision: 0,
      lease_version: 2, fence_hash: HASH_A, capability_manifest_hash: HASH_A,
      gpt_session_key: "product:recoverable", observed_at: "2030-01-01T00:00:00.000Z",
      clearance: "pending_unknown",
      worker_instance_id: "worker-recoverable", session_open_request_id: "aipsopen-recoverable",
      dialog_hash: HASH_A, observation_hash: HASH_A,
      target_ref_hash: HASH_A, document_ref_hash: HASH_A }),
  });
  assert.equal(store.hasUndeliveredProviderCooldown(), true,
    "a durable unsent provider cooldown intent must close local claim and submit admission");
  const providerControl = new ProviderRateLimitControl(store, {
    device: { device_id: "device-1" },
  } as never);
  assert.equal(providerControl.canRequestClaimAuthority(), false,
    "the worker must issue zero claim requests before the durable incident reaches Website");
  assert.throws(() => providerControl.assertProviderSubmitAllowed(),
    /PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE/u);
  assert.deepEqual(store.pendingProviderCooldownRequestIds(), [],
    "the recovery sender must not deliver an incident before durable acknowledgement clearance");
  assert.equal(store.pendingProviderCooldownIncidentBodies().length, 1);
  assert.deepEqual(store.providerCooldownSessionRecoveryIdentity(), {
    workerInstanceId: "worker-recoverable", sessionOpenRequestId: "aipsopen-recoverable",
  });
  const clearanceKey = `${cooldownKey}_clearance`;
  store.enqueue({
    idempotency_key: clearanceKey, kind: "provider_cooldown",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(accepted.job_id)}/provider-cooldown`,
    method: "POST", headers: { "x-ai-execution-fence-hash": HASH_A },
    body: JSON.stringify({ schema_version: "xuanxue-ai-provider-cooldown-notice.v6",
      request_id: clearanceKey, incident_request_id: cooldownKey, phase: "clearance",
      job_id: accepted.job_id, attempt_id: secondAttempt, result_revision: 0,
      lease_version: 2, fence_hash: HASH_A, capability_manifest_hash: HASH_A,
      gpt_session_key: "product:recoverable", observed_at: "2030-01-01T00:00:00.000Z",
      clearance: "confirmed_absent",
      worker_instance_id: "worker-recoverable", session_open_request_id: "aipsopen-recoverable",
      dialog_hash: HASH_A, observation_hash: HASH_A,
      target_ref_hash: HASH_A, document_ref_hash: HASH_A }),
  });
  database.prepare("update production_outbox set last_error='CLOUD_TRANSPORT_UNAVAILABLE' where idempotency_key=?")
    .run(cooldownKey);
  assert.deepEqual(store.pendingProviderCooldownRequestIds(), [cooldownKey, clearanceKey],
    "durable clearance unlocks ordered retry and transient provider delivery errors remain retryable");
  const receiptCore = {
    schema_version: "xuanxue-ai-provider-cooldown-receipt.v6" as const,
    request_id: cooldownKey, incident_request_id: cooldownKey,
    payload_hash: hashCanonical(JSON.parse(database.prepare(
      "select cast(body_blob as text) from production_outbox where idempotency_key=?",
    ).pluck().get(cooldownKey) as string)),
    device_id: "device-1", dialog_hash: HASH_A, observation_hash: HASH_A,
    target_ref_hash: HASH_A, document_ref_hash: HASH_A,
    level: 1, current_n: 2, baseline_n: 3,
    server_now: "2030-01-01T00:00:00.000Z", cooldown_until: "2030-01-01T00:05:00.000Z",
    clearance: "pending_unknown" as const, claim_gate_open: false,
    cohort_total: 1, cohort_admitted: 0, cohort_user_terminated: 0, cohort_pending: 1,
    cohort_effect_recovery: 0, cohort_unsent_resume: 0, cohort_unclassified: 1,
  };
  store.markOutboxSent(cooldownKey, {
    ...receiptCore, receipt_hash: hashCanonical(receiptCore),
  });
  assert.equal(store.hasUndeliveredProviderCooldown(), true,
    "the matching durable clearance remains a fail-closed claim barrier until Website delivery");
  providerControl.observeWebsiteAuthority({
    serverNow: new Date(Date.now() + 3_600_000).toISOString(), reasonCodes: [],
  });
  assert.throws(() => providerControl.assertProviderSubmitAllowed(),
    /PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE/u,
    "neither local wall-clock drift nor a claim observation predating durable clearance may open the gate");

  const receiptExpectation = {
    requestId: cooldownKey, incidentRequestId: cooldownKey,
    payloadHash: receiptCore.payload_hash, deviceId: "device-1",
    dialogHash: HASH_A, observationHash: HASH_A, targetRefHash: HASH_A, documentRefHash: HASH_A,
  };
  assert.doesNotThrow(() => parseProviderCooldownReceipt(
    { ...receiptCore, receipt_hash: hashCanonical(receiptCore) }, receiptExpectation,
  ));
  assert.throws(() => parseProviderCooldownReceipt(
    { ...receiptCore, current_n: 1, receipt_hash: hashCanonical(receiptCore) }, receiptExpectation,
  ), /PROVIDER_COOLDOWN_RECEIPT_INVALID/u,
  "remote hydrate must reject a cooldown receipt whose self-hash does not bind its content");
  const clearanceBody = JSON.parse(database.prepare(
    "select cast(body_blob as text) from production_outbox where idempotency_key=?",
  ).pluck().get(clearanceKey) as string) as Record<string, unknown>;
  const clearanceCore = {
    ...receiptCore, request_id: clearanceKey, payload_hash: hashCanonical(clearanceBody),
    server_now: "2030-01-01T00:00:01.000Z", clearance: "confirmed_absent" as const,
  };
  store.markOutboxSent(clearanceKey, {
    ...clearanceCore, receipt_hash: hashCanonical(clearanceCore),
  });
  providerControl.observeWebsiteAuthority({
    serverNow: "2030-01-01T00:05:00.000Z", reasonCodes: [],
  });
  assert.doesNotThrow(() => providerControl.assertProviderSubmitAllowed(),
    "only a later Website authority receipt without the active cooldown reason may reopen submit");
  const deliveredPhases: string[] = [];
  let failFirstNotCleared = true;
  let remoteClearance = "pending_unknown";
  const failedAckControl = new ProviderRateLimitControl(store, {
    device: { device_id: "device-1" },
    workerSessionId: "session-1",
    workerSessionEpoch: 1,
    workerInstanceId: "worker-recoverable",
    sessionOpenRequestId: "aipsopen-recoverable",
    request: async (_path: string, init: Readonly<{ body: Buffer }>) => {
      const body = JSON.parse(init.body.toString("utf8")) as Record<string, unknown>;
      deliveredPhases.push(`${String(body.phase)}:${String(body.clearance)}`);
      if (body.clearance === "not_cleared" && failFirstNotCleared) {
        failFirstNotCleared = false;
        throw new Error("COOLDOWN_RESPONSE_LOST");
      }
      if (body.clearance === "confirmed_absent" && remoteClearance !== "not_cleared") {
        throw new Error("OLD_CLEARANCE_NOT_DELIVERED");
      }
      remoteClearance = String(body.clearance);
      const core = {
        schema_version: "xuanxue-ai-provider-cooldown-receipt.v6" as const,
        request_id: String(body.request_id),
        payload_hash: hashCanonical(body),
        incident_request_id: String(body.incident_request_id),
        device_id: "device-1",
        dialog_hash: body.dialog_hash,
        observation_hash: body.observation_hash,
        target_ref_hash: body.target_ref_hash,
        document_ref_hash: body.document_ref_hash,
        level: 2, current_n: 1, baseline_n: 3,
        server_now: body.clearance === "confirmed_absent"
          ? "2030-01-01T00:11:00.000Z" : "2030-01-01T00:10:00.000Z",
        cooldown_until: "2030-01-01T00:20:00.000Z",
        clearance: body.clearance,
        claim_gate_open: false,
        cohort_total: 1, cohort_admitted: 0, cohort_user_terminated: 0, cohort_pending: 1,
        cohort_effect_recovery: 0, cohort_unsent_resume: 0, cohort_unclassified: 1,
      };
      return { ...core, receipt_hash: hashCanonical(core) };
    },
  } as never);
  const failedAckIncident = await failedAckControl.beginIncident({
    jobId: accepted.job_id,
    attemptId: secondAttempt,
    resultRevision: 0,
    deviceId: "device-1",
    leaseVersion: 2,
    fenceHash: HASH_A,
    capabilityManifestHash: HASH_A,
    dialogHash: HASH_A,
    observationHash: HASH_B,
    targetRefHash: HASH_A,
    documentRefHash: HASH_B,
    sessionKey: "product:failed-ack",
    observedAt: "2030-01-01T00:09:59.000Z",
  });
  await assert.rejects(failedAckIncident.deliver({
    clearance: "not_cleared",
    acknowledgementReceiptHash: HASH_B,
    acknowledgedAt: "2030-01-01T00:10:00.000Z",
  }), /COOLDOWN_RESPONSE_LOST/u);
  assert.deepEqual(deliveredPhases,
    ["incident:pending_unknown", "clearance:not_cleared"],
    "a failed not_cleared response keeps its original intent pending after the incident");
  assert.equal(failedAckControl.pendingIncidents().length, 1,
    "not_cleared must retain the original exact incident for zero-submit recovery");
  assert.throws(() => failedAckControl.assertProviderSubmitAllowed(),
    /PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE/u,
    "not_cleared must keep Provider submit closed");
  await failedAckControl.reconcilePendingIntents();
  await failedAckIncident.deliver({
    clearance: "confirmed_absent",
    acknowledgementReceiptHash: HASH_B,
    acknowledgedAt: "2030-01-01T00:11:00.000Z",
  });
  assert.deepEqual(deliveredPhases, ["incident:pending_unknown", "clearance:not_cleared",
    "clearance:not_cleared", "clearance:confirmed_absent"],
  "the original not_cleared receipt must precede the later confirmed_absent clearance");
  database.prepare(`update production_outbox set created_at=?
    where idempotency_key in (?,?)`).run("2030-01-01T00:10:00.000Z",
    `${failedAckIncident.incidentRequestId}_not_cleared`,
    `${failedAckIncident.incidentRequestId}_clearance`);
  assert.equal(store.latestProviderCooldownClearance(), "confirmed_absent",
    "a same-millisecond not_cleared key must not outrank the later confirmed_absent intent");
  assert.equal(store.latestProviderCooldownServerNow(), "2030-01-01T00:11:00.000Z");
  const loopSource = await readFile(new URL(
    "../../src/lib/local-runtime/production/runtime-loops.ts", import.meta.url), "utf8");
  const iteration = loopSource.slice(loopSource.indexOf("const workerIteration ="));
  assert.ok(iteration.indexOf("providerRateLimitControl.reconcilePendingIntents()")
    < iteration.indexOf("executor.reconcilePendingProviderRateLimitIncidents"),
  "each recovery iteration must send old durable cooldown intents before Browser forms new clearance");
  const staged = { ...resultFor(accepted), evidence_refs: [`art-${"a".repeat(64)}`] };
  store.markExecuting(accepted.job_id);
  store.stageResult(accepted.job_id, secondAttempt, staged);
  store.enqueue({ idempotency_key: "artifact:envelope", kind: "artifact",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(accepted.job_id)}/artifacts/envelope`,
    method: "PUT", headers: {}, body: Buffer.from("envelope") });
  store.markOutboxSent("artifact:envelope", { receipt_hash: HASH_A });
  const terminalKey = "terminal:three-truths";
  const terminal = { schema_version: "xuanxue-ai-terminal-cas.v6", job_id: accepted.job_id,
    terminal_status: "completed", payload_hash: hashCanonical(staged), failure: null,
    worker_session_id: "session:ledger", worker_session_epoch: 1,
    result_object_receipts: [HASH_A, HASH_B] };
  store.enqueue({ idempotency_key: terminalKey, kind: "terminal",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(accepted.job_id)}/terminal`,
    method: "POST", headers: {}, body: JSON.stringify(terminal) });
  assert.doesNotThrow(() => store.assertStartupDataIntegrity(),
    "forensics art-* evidence refs must not be reinterpreted as Website receipt hashes");
  database.prepare("update production_outbox set path='invalid' where idempotency_key=?").run(terminalKey);
  assert.throws(() => store.assertStartupDataIntegrity(),
    (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_LEDGER_INVARIANT_INVALID");
  database.prepare("update production_outbox set path=? where idempotency_key=?")
    .run(`/internal/ai-production/v6/jobs/${encodeURIComponent(accepted.job_id)}/terminal`, terminalKey);
  database.prepare("update production_outbox set body_blob=? where idempotency_key=?")
    .run(Buffer.from(JSON.stringify({ ...terminal, result_object_receipts: [HASH_A, hashCanonical("missing")] })), terminalKey);
  assert.throws(() => store.assertStartupDataIntegrity(),
    (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_LEDGER_INVARIANT_INVALID");
  database.prepare("update production_outbox set body_blob=? where idempotency_key=?")
    .run(Buffer.from(JSON.stringify({ ...terminal, payload_hash: HASH_A })), terminalKey);
  assert.throws(() => store.assertStartupDataIntegrity(),
    (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_LEDGER_INVARIANT_INVALID");
  database.prepare("update production_outbox set body_blob=? where idempotency_key=?")
    .run(Buffer.from(JSON.stringify(terminal)), terminalKey);
  store.markOutboxSent(terminalKey, {
    schema_version: "xuanxue-ai-terminal-receipt.v6", job_id: accepted.job_id,
    terminal_status: "completed", payload_hash: hashCanonical(staged), failure: null,
    first_terminal: true, device_id: "device:ledger", device_epoch: 1,
    worker_session_id: "session:ledger", worker_session_epoch: 1,
    runtime_attestation_receipt_hash: HASH_A,
  });
  const replacedKey = "artifact:replaced-before-completion";
  store.enqueue({ idempotency_key: replacedKey, kind: "artifact",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(accepted.job_id)}/artifacts/replaced`,
    method: "PUT", headers: {}, body: Buffer.from("replaced") });
  database.prepare("update production_outbox set last_error='WEBSITE_ATTEMPT_REPLACED' where idempotency_key=?")
    .run(replacedKey);
  store.completeTask(accepted.job_id, staged);
  assert.doesNotThrow(() => store.assertStartupDataIntegrity(),
    "a write Website replaced before the job completed is settled, not pending");
  database.prepare("update production_outbox set last_error='INTERNAL_ERROR' where idempotency_key=?")
    .run(replacedKey);
  assert.throws(() => store.assertStartupDataIntegrity(),
    (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_LEDGER_INVARIANT_INVALID",
    "any other unsent write under a completed job still breaks the ledger");
  store.close();

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
} finally {
  await rm(temporary, { recursive: true, force: true });
}

for (const evidenceMode of ["exam.golden", "exam.property", "exam.state-machine"] as const) {
  emitQualityProofObservation({
    lawId: "LAW-AGENT-PRODUCTION-RUNTIME-005-V40",
    evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "forbidden:3", "summary"],
    locator: `acceptance:agent-production-runtime:three-table-authority:${evidenceMode}`,
    observedValue: "three-table SQLite authority stores task state, Outbox and source handoff evidence; ordinary startup rejects migration and lease checkpoint continuation mirrors",
  });
}
