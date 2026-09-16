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
import { ProviderRateLimitControl } from
  "../../src/lib/local-runtime/production/provider-rate-limit-control.js";
import { parseProviderCooldownReceipt } from
  "../../src/lib/local-runtime/production/provider-cooldown-receipt.js";
import { serializeTerminalFailure } from "../../src/lib/local-runtime/production/terminal-failure.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { HASH_A, HASH_B, resultFor, task } from "./agent-production-runtime-fixtures.js";
import { verifyBrowserFailureStoreContract, verifyBrowserHostRestoreContract } from
  "./agent-production-runtime-browser-failure.acceptance-support.js";

await verifyBrowserHostRestoreContract();

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
  assert.deepEqual(tableNames(database), ["production_outbox", "production_tasks"]);
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

  const secondAttempt = "attempt:three-truths:2";
  const second = store.acceptTask(accepted, secondAttempt);
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
  const failedAckControl = new ProviderRateLimitControl(store, {
    device: { device_id: "device-1" },
    workerSessionId: "session-1",
    workerSessionEpoch: 1,
    workerInstanceId: "worker-recoverable",
    sessionOpenRequestId: "aipsopen-recoverable",
    request: async (_path: string, init: Readonly<{ body: Buffer }>) => {
      const body = JSON.parse(init.body.toString("utf8")) as Record<string, unknown>;
      deliveredPhases.push(`${String(body.phase)}:${String(body.clearance)}`);
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
        server_now: "2030-01-01T00:10:00.000Z",
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
  await failedAckIncident.deliver({
    clearance: "not_cleared",
    acknowledgementReceiptHash: HASH_B,
    acknowledgedAt: "2030-01-01T00:10:00.000Z",
  });
  assert.deepEqual(deliveredPhases,
    ["incident:pending_unknown", "clearance:not_cleared"],
    "an acknowledgement failure must still durably notify Website in incident-first order");
  assert.equal(failedAckControl.pendingIncidents().length, 1,
    "not_cleared must retain the original exact incident for zero-submit recovery");
  assert.throws(() => failedAckControl.assertProviderSubmitAllowed(),
    /PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE/u,
    "not_cleared must keep Provider submit closed");
  const staged = { ...resultFor(accepted), evidence_refs: [`art-${"a".repeat(64)}`] };
  store.stageResult(accepted.job_id, staged);
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
    lawId: "LAW-AGENT-PRODUCTION-RUNTIME-005-V33",
    evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "forbidden:3", "summary"],
    locator: `acceptance:agent-production-runtime:two-table-authority:${evidenceMode}`,
    observedValue: "two-table SQLite authority stores task state and Outbox only and rejects lease checkpoint continuation or failure-ledger mirrors",
  });
}
