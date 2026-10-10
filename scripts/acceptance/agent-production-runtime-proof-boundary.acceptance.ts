import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { sentProductionCheckpointPrefix } from "./agent-production-runtime.real-proof-support.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { readHealth } from "../../src/lib/local-runtime/production/runtime-loops.js";
import { readProductionOperationsSnapshot } from "../../src/lib/local-runtime/production/operations-snapshot.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { BrowserLaneCoordinator } from "../../src/lib/browser/infrastructure/browser-lane-coordinator.js";
import { BrowserAuthorityBroker } from "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "../../src/lib/browser/infrastructure/browser-authority-issuer.js";
import { createBrowserInfrastructureState } from "../../src/lib/browser/infrastructure/browser-infrastructure-state.js";
import { BrowserAuthorityWebSocket } from "../../src/lib/browser/transport/browser-authority-websocket.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { identity, terminalFact } from "./local-browser-mutation-store-support.js";
import { HASH_A, resultFor, shutdownRuntimeFixture, stageResultForAcceptance, task } from "./agent-production-runtime-fixtures.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";

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

const healthDirectory = await mkdtemp(path.join(tmpdir(), "agent-health-projection-"));
const runtimeStore = new ProductionRuntimeStore(healthDirectory);
const mutationStore = new BrowserMutationStore(path.join(healthDirectory, "browser"));
mutationStore.verifyRuntimeTaskProvenance(null);
const forbiddenAction = (): never => { throw new Error("HEALTH_READ_MUTATION"); };
const issuer = new BrowserAuthorityIssuer();
const broker = new BrowserAuthorityBroker(issuer, forbiddenAction, forbiddenAction);
const websocket = new BrowserAuthorityWebSocket({
  pairingSecret: null, onPairingStarted: forbiddenAction, onHeartbeat: forbiddenAction,
  onAuthenticated: forbiddenAction, onMutationReceipt: forbiddenAction,
  onTargetClaim: forbiddenAction, onTargetRevoke: forbiddenAction,
  onDiagnostic: forbiddenAction, onRevoked: forbiddenAction,
});
const infrastructure = createBrowserInfrastructureState();
infrastructure.mutationState = mutationStore;
const lane = new BrowserLaneCoordinator(() => broker, websocket, issuer, infrastructure);
let authority: "present" | "absent" = "present";
let target: "claimed" | "absent" = "absent";
let sink: "ready" | "failed" | "capacity_blocked" = "ready";
const runtimeLogger = Object.assign(createRuntimeLogger({
  producer: "health-projection-exam", owner: "production-runtime", component: "health-projection",
  terminalEnabled: false, fileSink: { directoryPath: path.join(healthDirectory, "logs") },
}), { isWritable: () => sink === "ready", getSinkState: () => sink });
const state = shutdownRuntimeFixture({ store: runtimeStore, dataDir: healthDirectory, runtimeLogger,
  browser: {
    readProductionRuntimeState: () => ({ browserAuthorityState: authority, browserTargetState: target }),
    readBrowserLaneState: () => lane.readState(),
    hasBrowserMutationForJob: mutationStore.hasMutationForJob.bind(mutationStore),
    hasUnresolvedBrowserMutation: () => mutationStore.countDispatched() > 0,
  },
});
const snapshot = (health = readHealth(state)) => readProductionOperationsSnapshot({
  dataDir: healthDirectory, store: runtimeStore, browser: state.browserAuthority,
  health: () => health, session: null, jobId: undefined,
});
const executionRow = async (health = readHealth(state)) => {
  const observed = await snapshot(health);
  const execution = observed.rows.find(entry => entry.axis === "execution")!;
  assert.equal(execution.authority_ref, "agent:production-runtime-health");
  assert.equal(execution.freshness.kind, "snapshot");
  assert.equal(execution.evidence_ref, null);
  assert.equal(observed.schema_version, "agent-production-operations-snapshot.v1");
  return execution;
};
try {
  assert.equal(readHealth(state).executionState, "ready", "an idle targetless Authority can execute");
  assert.equal(readHealth(state).browserTargetState, "absent");
  assert.equal(readHealth(state).claimAdmissionState, "eligible");
  Reflect.set(lane, "active", true);
  assert.equal(readHealth(state).executionState, "ready", "busy is serialized capacity, not unresolved input");
  assert.equal(readHealth(state).browserLaneState, "busy");
  Reflect.set(lane, "active", false);
  const command = identity("health-unresolved-command", "health-old-attempt");
  mutationStore.prepare(command); mutationStore.markDispatched(command.commandId);
  const walBefore = mutationStore.readCommand(command.commandId);
  assert.equal(lane.readState(), "blocked");
  assert.equal(readHealth(state).browserState, "ready", "Authority presence remains its own dimension");
  assert.equal(readHealth(state).executionState, "blocked", "real unresolved WAL cannot produce execution green");
  assert.equal(readHealth(state).claimAdmissionState, "eligible", "health must not change claim admission");
  for (const lastErrorCode of [null, "OLD_UNRELATED_FAILURE"]) {
    const health = { ...readHealth(state), lastErrorCode };
    const row = await executionRow(health);
    assert.equal(row.reason_code, "BROWSER_LANE_BLOCKED"); assert.equal(row.completeness, "COMPLETE");
    const axes = (await snapshot(health)).rows;
    assert.equal(axes.find(entry => entry.axis === "browser_authority")?.current_value, "present");
    assert.equal(axes.find(entry => entry.axis === "runtime_log_sink")?.current_value, "ready");
    assert.equal(axes.find(entry => entry.axis === "browser_lane")?.current_value, "blocked");
    assert.deepEqual(axes.find(entry => entry.axis === "browser_wal")?.current_value,
      { job_effect_present: null, unresolved_effect_present: true });
  }
  assert.deepEqual(mutationStore.readCommand(command.commandId), walBefore,
    "health and matrix reads cannot change the original WAL or input count");
  state.draining = true;
  assert.equal(readHealth(state).executionState, "draining", "draining takes precedence over a blocked lane");
  assert.equal((await executionRow({ ...readHealth(state), lastErrorCode: "OLD_ERROR" })).reason_code, null);
  state.draining = false;
  authority = "absent";
  assert.equal(readHealth(state).executionState, "blocked");
  assert.equal((await executionRow()).reason_code, "BROWSER_AUTHORITY_ABSENT");
  authority = "present";
  for (const unavailable of ["failed", "capacity_blocked"] as const) {
    sink = unavailable;
    assert.equal(readHealth(state).executionState, "blocked");
    assert.equal((await executionRow()).reason_code, "RUNTIME_LOG_SINK_UNAVAILABLE");
  }
  sink = "ready";
  mutationStore.settleTerminalReceipt(terminalFact(command));
  assert.equal(readHealth(state).executionState, "ready", "trusted original settlement restores readiness");
  assert.equal((await executionRow({ ...readHealth(state), lastErrorCode: "OLD_ERROR" })).reason_code, null);
  target = "claimed";
  assert.equal(readHealth(state).executionState, "ready");
  target = "absent";
  for (const unavailable of ["failed", "capacity_blocked"] as const) {
    sink = unavailable;
    assert.equal(readHealth(state).executionState, "blocked", "log failure independently blocks execution");
  }
  sink = "ready";
  for (const lastErrorCode of ["CREDENTIAL_INVALID", "SESSION_HEARTBEAT_FAILED"]) {
    state.lastErrorCode = lastErrorCode;
    assert.equal(readHealth(state).executionState, "blocked");
    const row = await executionRow();
    assert.equal(row.reason_code, null); assert.equal(row.completeness, "DIAGNOSIS_INCOMPLETE");
  }
  state.lastErrorCode = null;
  state.stopped = true; state.draining = true;
  assert.equal(readHealth(state).executionState, "blocked", "Cloud not ready precedes draining");
  state.stopped = false; state.draining = false;
  const ledgerReader = runtimeStore.isLedgerConsistent;
  runtimeStore.isLedgerConsistent = () => false;
  assert.equal(readHealth(state).executionState, "blocked");
  for (const lastErrorCode of [null, "OLD_FAILURE"]) {
    const row = await executionRow({ ...readHealth(state), lastErrorCode });
    assert.equal(row.reason_code, null); assert.equal(row.completeness, "DIAGNOSIS_INCOMPLETE");
  }
  runtimeStore.isLedgerConsistent = ledgerReader;
  const deliveryCommand = identity("health-unresolved-delivery", "health-delivery-attempt");
  mutationStore.prepare(deliveryCommand); mutationStore.markDispatched(deliveryCommand.commandId);
  const deliveryWalBefore = mutationStore.readCommand(deliveryCommand.commandId);
  assert.equal(readHealth(state).executionState, "blocked");
  const accepted = task({ jobId: "job:health:delivery", productId: "payment_screenshot_observation", actionId: "observe" });
  runtimeStore.acceptTask(accepted, "attempt:delivery"); runtimeStore.markExecuting(accepted.job_id);
  stageResultForAcceptance(runtimeStore, accepted.job_id, "attempt:delivery", resultFor(accepted));
  let deliveries = 0;
  const key = `terminal:acceptance:${accepted.job_id}:attempt:delivery`;
  await runtimeStore.deliverOutbox(key, async () => {
    deliveries += 1;
    return { schema_version: "xuanxue-ai-terminal-receipt.v6", job_id: accepted.job_id,
      terminal_status: "completed", payload_hash: hashCanonical(resultFor(accepted)), failure: null,
      first_terminal: true, device_id: "device:acceptance", device_epoch: 1,
      worker_session_id: "session:acceptance", worker_session_epoch: 1,
      runtime_attestation_receipt_hash: HASH_A };
  });
  assert.equal(deliveries, 1, "blocked health cannot block the existing result Outbox");
  assert.deepEqual(runtimeStore.readTask(accepted.job_id)?.staged_result, resultFor(accepted));
  assert.deepEqual(mutationStore.readCommand(deliveryCommand.commandId), deliveryWalBefore);

} finally {
  mutationStore.close(); runtimeStore.close();
  await rm(healthDirectory, { recursive: true, force: true });
}
