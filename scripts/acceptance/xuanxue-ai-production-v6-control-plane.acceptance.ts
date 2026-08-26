import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { XuanxueAiProductionCloudOutbox } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-outbox.js";
import { openXuanxueAiProductionDatabase } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-store-database.js";
import {
  readXuanxueAiProductionCloudCredential,
  writeXuanxueAiProductionCloudCredential,
  xuanxueAiProductionCloudCredentialPath,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-credential.js";
import {
  readXuanxueAiIntervention,
  requestXuanxueAiIntervention,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-store-intervention.js";
import { cloudWorkerPollIntervalMs } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-worker-support.js";

const temporary = mkdtempSync(path.join(os.tmpdir(), "xuanxue-ai-v6-control-"));
const database = openXuanxueAiProductionDatabase(temporary);
const hash = `sha256:${"a".repeat(64)}` as const;
const stageExecutionSource = readFileSync(
  path.resolve("src/plugins/xuanxue-ai-production/xuanxue-ai-production-stage-execution.ts"),
  "utf8",
);
assert.match(stageExecutionSource, /BROWSER_OUTCOME_UNKNOWN[\s\S]*status: "review_required"/u);

try {
  process.env.XUANXUE_AI_PRODUCTION_POLL_INTERVAL_MS = "30000";
  assert.equal(cloudWorkerPollIntervalMs(), 30_000);
  process.env.XUANXUE_AI_PRODUCTION_POLL_INTERVAL_MS = "30001";
  assert.equal(cloudWorkerPollIntervalMs(), 5_000);
  delete process.env.XUANXUE_AI_PRODUCTION_POLL_INTERVAL_MS;

  database.prepare(`insert into production_orders(
    order_id,source_task_id,product_id,request_hash,status,order_json,created_at,updated_at
  ) values(?,?,?,?,?,?,?,?)`).run(
    "local-order-1", "source-task-1", "bazi_analysis", hash, "running", "{}",
    new Date().toISOString(), new Date().toISOString(),
  );
  const readOrder = () => ({ order: { orderId: "local-order-1" }, status: "running" }) as never;
  const first = requestXuanxueAiIntervention(database, readOrder, "pause", {
    orderId: "local-order-1", expectedRevision: 0, requestId: "cloud-control:2", reason: "pause",
  }, 2);
  assert.equal(first.state, "pause_requested");
  assert.equal(first.lastControlEpoch, 2);
  const stale = requestXuanxueAiIntervention(database, readOrder, "cancel", {
    orderId: "local-order-1", expectedRevision: 1, requestId: "cloud-control:1", reason: "stale",
  }, 1);
  assert.equal(stale.state, "pause_requested");
  assert.equal(stale.lastControlEpoch, 2);
  assert.equal(readXuanxueAiIntervention(database, readOrder, "local-order-1").lastControlEpoch, 2);

  const outbox = new XuanxueAiProductionCloudOutbox(database);
  for (const [index, writeKind] of (["checkpoint", "artifact", "terminal", "cancel", "handover"] as const).entries()) {
    outbox.enqueue({
      requestId: `write-${index}`, jobId: "job-1", writeKind,
      method: writeKind === "artifact" ? "PUT" : "POST", pathname: `/v6/${writeKind}`,
      headers: {}, body: writeKind === "artifact" ? null : { writeKind }, bodyFile: null,
      payloadHash: hash,
    });
  }
  assert.deepEqual(outbox.pending().map((write) => write.writeKind), [
    "checkpoint", "artifact", "terminal", "cancel", "handover",
  ]);
  assert.throws(() => outbox.enqueue({
    requestId: "write-0", jobId: "job-1", writeKind: "checkpoint", method: "POST",
    pathname: "/changed", headers: {}, body: {}, bodyFile: null,
    payloadHash: `sha256:${"b".repeat(64)}`,
  }), /OUTBOX_IDEMPOTENCY_CONFLICT/u);
  outbox.recordPermanentRejection({
    requestId: "write-2", reasonCode: "AI_LEASE_FENCE_STALE", payloadHash: hash,
  });
  assert.equal(outbox.pending().some((write) => write.requestId === "write-2"), false);
  const rejectedTerminal = database.prepare(`select state,response_json from production_cloud_outbox
    where request_id='write-2'`).get() as { state: string; response_json: string };
  assert.equal(rejectedTerminal.state, "acknowledged");
  assert.equal(JSON.parse(rejectedTerminal.response_json).reason_code, "AI_LEASE_FENCE_STALE");

  outbox.beginClaimRequest({ requestId: "claim-1", payload: { worker_session_id: "old-session" }, payloadHash: hash });
  assert.equal(outbox.pendingClaimRequest()?.requestId, "claim-1");
  outbox.commitClaimReceipt({
    requestId: "claim-1",
    claims: [{
      jobId: "job-claim", attemptId: "attempt-claim", leaseVersion: 1,
      createdAt: new Date().toISOString(), grant: { fence_hash: hash },
    }],
  });
  assert.equal(outbox.pendingClaimRequest(), null);
  assert.equal((database.prepare(`select count(*) as count from production_cloud_claim_ledger
    where job_id='job-claim' and attempt_id='attempt-claim' and lease_version=1`).get() as { count: number }).count, 1);
  outbox.beginClaimRequest({ requestId: "claim-conflict", payload: { worker_session_id: "old-session" }, payloadHash: hash });
  assert.throws(() => outbox.commitClaimReceipt({
    requestId: "claim-conflict",
    claims: [{
      jobId: "job-claim", attemptId: "attempt-claim", leaseVersion: 1,
      createdAt: new Date().toISOString(), grant: { fence_hash: `sha256:${"b".repeat(64)}` },
    }],
  }), /CLAIM_LEDGER_CONFLICT/u);
  assert.equal(outbox.pendingClaimRequest()?.requestId, "claim-conflict");

  const checkpointWrite = (requestId: string, attemptId: string, leaseVersion: number) =>
    outbox.enqueueCheckpoint({
      jobId: "job-sequence", attemptId, leaseVersion,
      buildWrite: (checkpointSequence) => ({
        requestId, jobId: "job-sequence", writeKind: "checkpoint", method: "POST",
        pathname: "/v6/checkpoint", headers: {}, body: { checkpoint_seq: checkpointSequence },
        bodyFile: null, payloadHash: hash,
      }),
    });
  assert.equal(checkpointWrite("checkpoint-atomic-1", "attempt-1", 1).body?.checkpoint_seq, 1);
  assert.throws(() => outbox.enqueueCheckpoint({
    jobId: "job-sequence", attemptId: "attempt-1", leaseVersion: 1,
    buildWrite: () => { throw new Error("FAULT_AFTER_SEQUENCE_BEFORE_OUTBOX"); },
  }), /FAULT_AFTER_SEQUENCE_BEFORE_OUTBOX/u);
  assert.equal((database.prepare(`select checkpoint_sequence from production_cloud_job_state
    where job_id='job-sequence' and attempt_id='attempt-1' and lease_version=1`).get() as { checkpoint_sequence: number }).checkpoint_sequence, 1);
  assert.equal(checkpointWrite("checkpoint-atomic-2", "attempt-1", 1).body?.checkpoint_seq, 2);
  assert.equal(checkpointWrite("checkpoint-attempt-2", "attempt-2", 2).body?.checkpoint_seq, 1);

  const databaseSource = readFileSync("src/plugins/xuanxue-ai-production/xuanxue-ai-production-store-database.ts", "utf8");
  const clientSource = readFileSync("src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-client.ts", "utf8");
  const workerSessionSource = readFileSync("src/plugins/xuanxue-ai-production/xuanxue-ai-production-worker-session.ts", "utf8");
  const workerSource = readFileSync("src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-worker.ts", "utf8");
  const workerContractSource = readFileSync("src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-worker-contract.ts", "utf8");
  const workbenchStatusSource = readFileSync("src/lib/local-runtime/workbench-status.ts", "utf8");
  assert.doesNotMatch(databaseSource, /session_token|current_token_hash|previous_token_hash/iu);
  assert.match(clientSource, /writeKind: "handover"/u);
  assert.match(clientSource, /HandoverV6Schema\.parse/u);
  assert.match(clientSource, /SUPERSEDED_CLAIM_RECONCILED/u);
  assert.match(clientSource, /commitClaimReceipt/u);
  assert.match(clientSource, /enqueueCheckpoint/u);
  assert.match(clientSource, /result\.response\.checkpoint_hash/u);
  assert.match(clientSource, /XUANXUE_AI_PRODUCTION_CHECKPOINT_RECEIPT_INVALID/u);
  assert.match(workerSessionSource, /public async authorizationHeaders[\s\S]*"x-ai-agent-origin": this\.device\.origin/u);
  const localIdentityIndex = workerSource.indexOf("state.execution.createOrder(preparedOrder)");
  const acceptanceIndex = workerSource.indexOf('status: "inputs_downloading", localOrderId');
  assert.ok(localIdentityIndex >= 0 && acceptanceIndex > localIdentityIndex,
    "immutable local order identity must be fsynced before the accepting checkpoint");
  for (const field of [
    "shellState", "cloudState", "browserState", "executionState",
    "claimAdmissionState", "browserAuthorityState", "browserTargetState", "browserLaneState",
  ]) assert.match(workerContractSource, new RegExp(`readonly ${field}:`, "u"), field);
  for (const component of [
    "xuanxueAiProductionShell", "agentCloudWorker",
    "xuanxueAiProductionBrowser", "xuanxueAiProductionExecution",
  ]) assert.match(workbenchStatusSource, new RegExp(`name: "${component}"`, "u"), component);
  assert.match(workbenchStatusSource, /AGENT Cloud Worker state=\$\{health\.cloudState\}/u);
  assert.doesNotMatch(workbenchStatusSource, /detail: `Cloud state=/u);
  assert.doesNotMatch(workerSource, /readonly status: "ready"/u);

  const credential = {
    protocol_version: "xuanxue-ai-production-v6",
    server_base_url: "https://cloud.example.test",
    environment_id: "production",
    origin: "https://agent.example.test",
    device_id: "device-1", device_epoch: 1,
    credential: `aidc_v6_${"x".repeat(32)}`,
    control_manifest_hash: hash,
    product_bundle_hash: hash,
    enrolled_at: new Date().toISOString(),
  } as const;
  await writeXuanxueAiProductionCloudCredential(temporary, credential);
  const credentialPath = xuanxueAiProductionCloudCredentialPath(temporary);
  assert.equal((await readXuanxueAiProductionCloudCredential(temporary)).device_id, "device-1");
  const credentialDirectory = path.dirname(credentialPath);
  chmodSync(credentialDirectory, 0o755);
  await assert.rejects(() => readXuanxueAiProductionCloudCredential(temporary), /CREDENTIAL_PERMISSIONS_INVALID/u);
  assert.equal(statSync(credentialDirectory).mode & 0o077, 0o055,
    "credential validation must never auto-repair an over-permissive directory");
  chmodSync(credentialDirectory, 0o700);
  chmodSync(credentialPath, 0o644);
  await assert.rejects(() => readXuanxueAiProductionCloudCredential(temporary), /CREDENTIAL_PERMISSIONS_INVALID/u);
  chmodSync(credentialPath, 0o600);
  writeFileSync(credentialPath, `${JSON.stringify({ protocol_version: "xuanxue-ai-production-v5" })}\n`, { mode: 0o600 });
  await assert.rejects(() => readXuanxueAiProductionCloudCredential(temporary), /CREDENTIAL_REENROLLMENT_REQUIRED/u);
  const realCredentialPath = `${credentialPath}.real`;
  renameSync(credentialPath, realCredentialPath);
  symlinkSync(realCredentialPath, credentialPath);
  await assert.rejects(() => readXuanxueAiProductionCloudCredential(temporary), /CREDENTIAL_PERMISSIONS_INVALID/u);
  const symlinkTarget = path.join(temporary, "credential-parent-target");
  const symlinkParent = path.join(temporary, "credential-parent-link");
  mkdirSync(symlinkTarget, { mode: 0o700 });
  symlinkSync(symlinkTarget, symlinkParent);
  const originalCredentialFile = process.env.XUANXUE_AI_PRODUCTION_CREDENTIAL_FILE;
  process.env.XUANXUE_AI_PRODUCTION_CREDENTIAL_FILE = path.join(symlinkParent, "credential.json");
  try {
    await assert.rejects(
      () => writeXuanxueAiProductionCloudCredential(temporary, credential),
      /CREDENTIAL_PERMISSIONS_INVALID/u,
      "credential write must reject a symlinked parent before creating any file",
    );
  } finally {
    if (originalCredentialFile === undefined) delete process.env.XUANXUE_AI_PRODUCTION_CREDENTIAL_FILE;
    else process.env.XUANXUE_AI_PRODUCTION_CREDENTIAL_FILE = originalCredentialFile;
  }
} finally {
  database.close();
  rmSync(temporary, { recursive: true, force: true });
}
