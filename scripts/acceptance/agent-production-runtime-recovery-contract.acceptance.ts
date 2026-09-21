import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { executionFailure, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import { readProductionDeviceJobStatus } from
  "../../src/lib/local-runtime/production/cloud-reconciliation-client.js";
import {
  serializeTerminalFailure,
  serializeTerminalFailureTransport,
} from "../../src/lib/local-runtime/production/terminal-failure.js";
import { attemptFailureFirstFact, task } from "./agent-production-runtime-fixtures.js";

const directory = await mkdtemp(path.join(tmpdir(), "agent-fresh-attempt-"));
try {
  const providerEffectHash = `sha256:${"c".repeat(64)}` as const;
  assert.deepEqual(serializeTerminalFailureTransport(
    executionFailure("failed", "PRODUCT_EXECUTION_FAILED", { metadata: {
      mutationOutcome: "confirmed",
      browserEffect: {
        effectScope: "provider_effect", childCapabilityId: "submit_exact_gpt_turn_once",
        browserOutcome: "CONFIRMED", providerEffectIdentityHash: providerEffectHash,
      },
    }}),
  ), { ...serializeTerminalFailure(executionFailure("failed", "PRODUCT_EXECUTION_FAILED")),
    mutation_outcome: "confirmed", effect_scope: "provider_effect",
    child_capability_id: "submit_exact_gpt_turn_once", browser_outcome: "CONFIRMED",
    provider_effect_identity_hash: providerEffectHash, settled_result_payload_hash: null });
  const remoteFailureCore = serializeTerminalFailureTransport(
    executionFailure("failed", "REMOTE_FAILURE_FACT"),
  );
  const remoteFailure = { ...remoteFailureCore, from_status: "failed", to_status: "failed",
    attempt_id: "attempt:remote-failure", lease_version: 3 };
  const deviceStatus = (attemptFailure: unknown) => ({
    schema_version: "xuanxue-ai-device-job-status.v6",
    job_id: "job:remote-failure",
    status: "failed",
    current_reason: null,
    attempt_failure: attemptFailure,
    control_intent: { schema_version: "xuanxue-ai-control-intent.v6",
      job_id: "job:remote-failure", control_epoch: 0, intent: "none", reason_code: null },
    next_action_code: "ACTIVE_ATTEMPT",
    terminal_status: null,
    terminal_payload_hash: null,
    business_admission_receipt: null,
    business_consumer_error: null,
    accepted_attempt_count: 1,
    write_receipts: [],
  });
  const parsedRemote = await readProductionDeviceJobStatus({
    request: async () => deviceStatus(remoteFailure),
  } as never, "job:remote-failure");
  assert.deepEqual(parsedRemote.attempt_failure, remoteFailure);
  await assert.rejects(readProductionDeviceJobStatus({
    request: async () => deviceStatus(serializeTerminalFailure(
      executionFailure("failed", "LEGACY_REMOTE_FAILURE"),
    )),
  } as never, "job:remote-failure"),
  (error: unknown) => typedExecutionFailure(error)?.code === "V6_DEVICE_ATTEMPT_FAILURE_INVALID");
  const runtimeClaim = await readFile(new URL(
    "../../src/lib/local-runtime/production/runtime-claim.ts", import.meta.url,
  ), "utf8");
  assert.doesNotMatch(runtimeClaim, /browser-mutation-authority|browser-mutations\.sqlite/u,
    "Runtime must transport the public typed effect fact without reading Browser private storage");
  assert.match(runtimeClaim, /serializeTerminalFailureTransport/u);
  assert.doesNotMatch(runtimeClaim, /provider_effect_identity_hash: _effectTransportOnly/u);
  assert.match(runtimeClaim, /buildProductionLeaseRelease/u);
  const runtimeLoops = await readFile(new URL(
    "../../src/lib/local-runtime/production/runtime-loops.ts", import.meta.url,
  ), "utf8");
  assert.match(runtimeLoops,
    /const browser = state\.browserAuthority\.readProductionRuntimeState\(\);[\s\S]*?browser\.browserAuthorityState === "present"[\s\S]*?if \(!eligible\) return 1_000;[\s\S]*?requestClaimBatch/u,
    "the worker must fail closed before claiming when Browser Authority is absent");
  const store = new ProductionRuntimeStore(directory);
  const job = task({
    jobId: "job:fresh-attempt",
    productId: "payment_screenshot_observation",
    actionId: "observe",
  });
  store.acceptTask(job, "attempt:1");
  const firstFailure = attemptFailureFirstFact("attempt:1",
    serializeTerminalFailure(executionFailure("failed", "PRODUCT_EXECUTION_FAILED")));
  store.recordAttemptFailure(
    job.job_id,
    "attempt:1",
    firstFailure,
  );
  const artifactKey = "artifact:fresh-attempt";
  store.enqueue({
    idempotency_key: artifactKey,
    kind: "artifact",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/artifacts/result`,
    method: "PUT",
    headers: {},
    body: Buffer.from("result"),
  });
  await assert.rejects(
    store.deliverOutbox(artifactKey, async () => {
      throw executionFailure("failed", "CLOUD_TRANSPORT_UNAVAILABLE");
    }),
    (error: unknown) => typedExecutionFailure(error)?.code === "CLOUD_TRANSPORT_UNAVAILABLE",
  );
  await assert.rejects(
    store.deliverOutbox(artifactKey, async () => {
      throw new Error("AN_ALREADY_RECORDED_FAILURE_MUST_NOT_BE_REPLAYED");
    }),
    (error: unknown) => typedExecutionFailure(error)?.code === "CLOUD_TRANSPORT_UNAVAILABLE",
  );
  assert.throws(() => store.acceptTask(job, "attempt:1"),
    /PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_REQUIRED/u);
  const regranted = store.acceptTaskAfterFailureReconciled(job, "attempt:1", firstFailure);
  assert.equal(regranted.current_reason, "LEASE_REGRANTED");
  assert.deepEqual(regranted.attempt_failure, firstFailure,
    "Website regrant of the same accepted attempt must retain the first failure fact");
  assert.throws(() => store.acceptTask(job, "attempt:2"),
    /PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_REQUIRED/u);
  const fresh = store.acceptTaskAfterFailureReconciled(job, "attempt:2", firstFailure);
  assert.equal(fresh.current_attempt_id, "attempt:2");
  assert.equal(fresh.attempt_failure, null);
  assert.equal(fresh.staged_result, null);
  assert.equal(fresh.current_reason, "LEASE_GRANTED");
  assert.equal(store.readOutboxAuthority(artifactKey)?.lastError, "WEBSITE_ATTEMPT_REPLACED");
  await assert.rejects(
    store.deliverOutbox(artifactKey, async () => {
      throw new Error("A_SUPERSEDED_WRITE_MUST_NOT_BE_SENT");
    }),
    (error: unknown) => typedExecutionFailure(error)?.code === "WEBSITE_ATTEMPT_REPLACED",
  );
  const regrantJob = task({ jobId: "job:regrant-fence", productId: "payment_screenshot_observation", actionId: "observe" });
  const regrantPath = (name: string) =>
    `/internal/ai-production/v6/jobs/${encodeURIComponent(regrantJob.job_id)}/artifacts/result_payload/${name}`;
  const fencedWrite = (key: string, fence: string, body = "same-result") => ({
    idempotency_key: key, kind: "artifact" as const, path: regrantPath(key), method: "PUT" as const,
    headers: { "x-ai-execution-fence-hash": fence, "content-type": "application/json", "x-ai-request-id": key },
    body: Buffer.from(body),
  });
  const receipt = { receipt_hash: `sha256:${"d".repeat(64)}` };
  const neverSend = async (): Promise<never> => { throw new Error("A_RECORDED_OR_REPLACED_WRITE_MUST_NOT_BE_SENT"); };
  assert.equal(store.acceptTask(regrantJob, "attempt:1").current_reason, "LEASE_GRANTED");
  store.enqueue(fencedWrite("regrant-result", "fence:A"));
  await assert.rejects(store.deliverOutbox("regrant-result", async () => {
    throw runtimeTransportFailure("INTERNAL_ERROR", 500);
  }), (error: unknown) => typedExecutionFailure(error)?.code === "INTERNAL_ERROR");
  store.enqueue(fencedWrite("regrant-result", "fence:A"));
  assert.equal(store.readOutboxAuthority("regrant-result")?.lastError, "INTERNAL_ERROR",
    "re-enqueue under the same fence must keep the recorded failure");
  await assert.rejects(store.deliverOutbox("regrant-result", neverSend),
    (error: unknown) => typedExecutionFailure(error)?.code === "INTERNAL_ERROR",
    "the same lease must not replay a recorded failure");
  assert.equal(store.acceptTask(regrantJob, "attempt:1").current_reason, "LEASE_REGRANTED");
  store.enqueue(fencedWrite("regrant-result", "fence:B"));
  assert.equal(store.readOutboxAuthority("regrant-result")?.lastError, null);
  const delivered = await store.deliverOutbox("regrant-result", async (write) => {
    assert.equal(write.headers["x-ai-execution-fence-hash"], "fence:B");
    return receipt;
  });
  assert.equal(store.readOutboxAuthority("regrant-result")?.state, "delivered");
  store.enqueue(fencedWrite("regrant-result", "fence:C"));
  assert.deepEqual(await store.deliverOutbox("regrant-result", neverSend), delivered,
    "a delivered write returns its stored receipt under a later fence");
  assert.throws(() => store.enqueue(fencedWrite("regrant-result", "fence:C", "different-result")),
    (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT");
  assert.throws(() => store.enqueue({ ...fencedWrite("regrant-result", "fence:C"),
    headers: { ...fencedWrite("regrant-result", "fence:C").headers, "content-type": "application/octet-stream" } }),
    (error: unknown) => typedExecutionFailure(error)?.code === "PRODUCTION_OUTBOX_IDEMPOTENCY_CONFLICT",
    "only the execution fence header may differ");
  store.enqueue(fencedWrite("regrant-stale", "fence:A"));
  await assert.rejects(store.deliverOutbox("regrant-stale", async () => {
    throw runtimeTransportFailure("AI_LEASE_FENCE_STALE", 409);
  }));
  assert.equal(store.readOutboxAuthority("regrant-stale")?.lastError, "WEBSITE_HTTP_409:AI_LEASE_FENCE_STALE");
  store.acceptTask(regrantJob, "attempt:1");
  store.enqueue(fencedWrite("regrant-stale", "fence:B"));
  assert.equal(store.readOutboxAuthority("regrant-stale")?.lastError, null);
  await store.deliverOutbox("regrant-stale", async (write) => {
    assert.equal(write.headers["x-ai-execution-fence-hash"], "fence:B");
    return receipt;
  });
  assert.equal(store.readOutboxAuthority("regrant-stale")?.state, "delivered");
  store.enqueue(fencedWrite("regrant-replaced", "fence:A"));
  const replacedFailure = attemptFailureFirstFact("attempt:1",
    serializeTerminalFailure(executionFailure("failed", "PRODUCT_EXECUTION_FAILED")));
  store.recordAttemptFailure(regrantJob.job_id, "attempt:1", replacedFailure);
  store.acceptTaskAfterFailureReconciled(regrantJob, "attempt:2", replacedFailure);
  assert.equal(store.readOutboxAuthority("regrant-replaced")?.lastError, "WEBSITE_ATTEMPT_REPLACED");
  store.enqueue(fencedWrite("regrant-replaced", "fence:B"));
  await assert.rejects(store.deliverOutbox("regrant-replaced", neverSend),
    (error: unknown) => typedExecutionFailure(error)?.code === "WEBSITE_ATTEMPT_REPLACED");
  store.close();
} finally {
  await rm(directory, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE][agent-production-runtime-fresh-attempt] PASS\n");
