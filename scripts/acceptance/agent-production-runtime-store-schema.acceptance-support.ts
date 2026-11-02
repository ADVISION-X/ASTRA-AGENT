import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { executionFailure, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { resolveStoredProductionAuthority } from
  "../../src/lib/local-runtime/production/store-authority-reader.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { HASH_A, claimTask, deviceStatusWithoutAdmission, resultFor, shutdownRuntimeFixture,
  stageResultForAcceptance, task } from "./agent-production-runtime-fixtures.js";
import { hashCanonical, sha256, type WebsiteAgentTask } from "../../src/lib/local-runtime/production/contracts.js";
import type { SourceAttemptHandoff } from "../../src/lib/local-runtime/production/source-readback-contract.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { reconcileRuntimeAuthorities, runtimeState, workerLoop } from "../../src/lib/local-runtime/production/runtime-loops.js";
import { purgeDeletedJob, websiteJobAbsent } from "../../src/lib/local-runtime/production/runtime-business-admission.js";
import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import { executeClaim } from "../../src/lib/local-runtime/production/runtime-claim.js";
import { uploadProductionResult } from "../../src/lib/local-runtime/production/cloud-client.js";
import { buildTerminalProductionIntent } from "../../src/lib/local-runtime/production/cloud-terminal-intent.js";
import { ClaimBatchReceiptSchema, ClaimedProductionTaskSchema, DeviceCredentialSchema } from "../../src/lib/local-runtime/production/transport-protocol.js";
import { ProductionWorkerSession } from "../../src/lib/local-runtime/production/worker-session.js";
import type { RuntimeState } from "../../src/lib/local-runtime/production/runtime-state.js";
import { prepareSourceHandoffs } from "../../src/lib/local-runtime/production/runtime-source-handoff.js";
import { recordSourceCheckpoint } from "../../src/lib/local-runtime/production/executor-source-checkpoint.js";
import { validDeviceCredential } from "./agent-production-runtime-fixtures.js";

const zeroInputSeal = (store: ProductionRuntimeStore, base: WebsiteAgentTask): SourceAttemptHandoff => {
  const body = { kind: "attempt_handoff" as const, job_id: base.job_id, source_attempt_id: "attempt:output",
    source_task_hash: hashCanonical(base), first_fact_raw_hash: null,
    outbox_history_hash: store.readResultOutboxHistoryEvidence(base.job_id, "attempt:output").historyHash,
    outbox_candidate_count: 0, payload_slot_conflict: null, browser_history_hash: HASH_A,
    browser_row_count: 0, browser_input_state: "zero" as const, replay_calls: [], rejected_call: null,
    readback_proofs: [], input_quiescence_proof: null, readback_exhaustion_hash: null };
  return { ...body, seal_hash: hashCanonical(body) };
};

const verifyCompleteOutputDurability = async (temporary: string): Promise<void> => {
  const directory = path.join(temporary, "complete-output"); await mkdir(directory);
  const base = task({ jobId: "job:complete-output", productId: "payment_screenshot_observation", actionId: "observe" });
  const output = { payload: { original: "保留原字节\\n", nested: { z: 1, a: 2 } }, evidence_refs: ["proof:original"] };
  let store = new ProductionRuntimeStore(directory); store.acceptTask(base, "attempt:output");
  const preserved = store.preserveCompleteOutput(base.job_id, "attempt:output", output, []);
  assert.equal(preserved.payload_json, JSON.stringify(output.payload));
  assert.equal(preserved.execution_receipt_hash, hashCanonical({ job_id: base.job_id, attempt_id: "attempt:output",
    request_hash: base.request_hash, product_id: base.product_id, action_id: base.action_id,
    payload_hash: sha256(Buffer.from(JSON.stringify(output.payload), "utf8")), evidence_refs: output.evidence_refs }));
  assert.deepEqual(store.preserveCompleteOutput(base.job_id, "attempt:output", output, []), preserved);
  assert.throws(() => store.preserveCompleteOutput(base.job_id, "attempt:output", { ...output, payload: "different" }, []),
    /PRODUCTION_COMPLETE_OUTPUT_CONFLICT/u);
  assert.throws(() => store.sealSourceHandoff(zeroInputSeal(store, base)), /PRODUCTION_SOURCE_HANDOFF_CONFLICT/u,
    "a complete unstaged output closes the otherwise valid seal path");
  store.close(); store = new ProductionRuntimeStore(directory);
  assert.deepEqual(store.readCompleteOutput(base.job_id, "attempt:output"), preserved, "restart reads the original bytes and refs");
  const root = path.join(directory, "plugin-tasks", "production-runtime", base.job_id, "results");
  const file = path.join(root, (await readdir(root))[0]!, "complete-output.json");
  const originalBytes = await readFile(file);
  await writeFile(file, JSON.stringify({ ...preserved, payload_json: '"tampered"' }));
  assert.throws(() => store.readCompleteOutput(base.job_id, "attempt:output"), /PRODUCTION_COMPLETE_OUTPUT_IDENTITY_MISMATCH/u);
  assert.throws(() => store.sealSourceHandoff(zeroInputSeal(store, base)), /PRODUCTION_COMPLETE_OUTPUT_IDENTITY_MISMATCH/u,
    "unreadable output must not turn into an empty result candidate");
  await writeFile(file, originalBytes);
  assert.throws(() => stageResultForAcceptance(store, base.job_id, "attempt:output", resultFor(base)),
    /PRODUCTION_COMPLETE_OUTPUT_IDENTITY_MISMATCH/u, "a staged envelope must bind the same complete output");
  assert.equal(store.readTask(base.job_id)!.staged_result, null);
  assert.deepEqual(store.readCompleteOutput(base.job_id, "attempt:output"), preserved);
  const sealed = task({ jobId: "job:sealed-output", productId: "payment_screenshot_observation", actionId: "observe" });
  store.acceptTask(sealed, "attempt:output"); store.sealSourceHandoff(zeroInputSeal(store, sealed));
  assert.throws(() => store.preserveCompleteOutput(sealed.job_id, "attempt:output", output, []), /PRODUCTION_COMPLETE_OUTPUT_CONFLICT/u,
    "the seal winner rejects a late completion");
  const linked = task({ jobId: "job:linked-output", productId: "payment_screenshot_observation", actionId: "observe" });
  store.acceptTask(linked, "attempt:output");
  await symlink(directory, path.join(directory, "plugin-tasks", "production-runtime", linked.job_id));
  assert.throws(() => store.preserveCompleteOutput(linked.job_id, "attempt:output", output, []), /PRODUCTION_COMPLETE_OUTPUT_PATH_INVALID/u);
  const race = task({ jobId: "job:outbox-race", productId: "payment_screenshot_observation", actionId: "observe" });
  store.acceptTask(race, "attempt:output"); const beforeCandidate = zeroInputSeal(store, race);
  const attemptHash = hashCanonical({ attempt_id: "attempt:output" }).slice(7, 23);
  store.enqueue({ idempotency_key: "envelope:late", kind: "artifact", method: "PUT", headers: {},
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(race.job_id)}/artifacts/result_envelope/late_${attemptHash}_result_envelope_original`,
    body: Buffer.from(JSON.stringify(resultFor(race))) });
  assert.throws(() => store.sealSourceHandoff(beforeCandidate), /PRODUCTION_SOURCE_HANDOFF_CONFLICT/u,
    "the same seal transaction must reject a newly arrived Outbox candidate after its preflight snapshot");
  assert.equal(store.readSealedSourceHandoff(race.job_id, "attempt:output"), null);
  assert.equal(store.readResultOutboxHistoryEvidence(race.job_id, "attempt:output").candidateCount, 1);
  store.close();
};

const retirementState = (store: ProductionRuntimeStore, directory: string,
  browser: NonNullable<Parameters<typeof shutdownRuntimeFixture>[0]["browser"]> = {}) => shutdownRuntimeFixture({
  store, dataDir: directory, browser, runtimeLogger: createRuntimeLogger({ producer: "retirement-mechanics",
    owner: "production-runtime", component: "production-runtime", terminalEnabled: false,
    fileSink: { directoryPath: path.join(directory, "logs") } }),
});

const verifyAllStatePaging = async (temporary: string): Promise<void> => {
  const directory = path.join(temporary, "all-state"); await mkdir(directory);
  let store = new ProductionRuntimeStore(directory);
  const ids = Array.from({ length: 65 }, (_, index) => `job:paging:${String(index).padStart(3, "0")}`);
  for (const [index, jobId] of ids.entries()) {
    const base = task({ jobId, productId: "payment_screenshot_observation", actionId: "observe" });
    store.acceptTask(base, "attempt:paging");
    if (index % 5 === 1 || index % 5 === 2) {
      const result = resultFor(base), receipt = stageResultForAcceptance(store, jobId, "attempt:paging", result);
      if (index % 5 === 2) { store.hydrateRemoteOutboxReceipts(jobId, [receipt]); store.completeTask(jobId, result); }
    }
    if (index % 5 === 3) store.setCurrentReason(jobId, "BROWSER_TARGET_CLEANUP_SETTLED");
  }
  const database = Reflect.get(store, "database") as Database.Database;
  database.prepare("update production_tasks set task_json='{}' where job_id=?").run(ids[0]);
  for (let restart = 0; restart < 2; restart++) {
    const state = retirementState(store, directory), seen = new Set<string>();
    state.active.set(ids[4]!, new Promise<void>(() => {}));
    let batch: string[] = [];
    state.session.request = async (pathname) => {
      const id = decodeURIComponent(pathname.split("/").at(-2)!); batch.push(id); seen.add(id);
      if (id === ids[1]) throw runtimeTransportFailure("TEMPORARY_STATUS_FAILURE", 503);
      return deviceStatusWithoutAdmission(id).request();
    };
    for (let pass = 0; pass < 3; pass++) {
      batch = []; await reconcileRuntimeAuthorities(state);
      assert.ok(batch.length <= 32); assert.equal(new Set(batch).size, batch.length);
    }
    assert.deepEqual([...seen].sort(), ids, "all durable states, a corrupt first row and a failed GET cannot hide the tail");
    state.active.clear(); store.close();
    if (restart === 0) store = new ProductionRuntimeStore(directory);
  }
};

const verifyPurgeJoinsRealWriter = async (temporary: string): Promise<void> => {
  const directory = path.join(temporary, "writer-join"); await mkdir(directory);
  const store = new ProductionRuntimeStore(directory), order: string[] = [];
  const state = retirementState(store, directory, {
    releaseJobBoundTarget: async () => { order.push("release"); },
    purgeBrowserJob: () => { order.push("browser"); },
  });
  const base = task({ jobId: "job:late-writer", productId: "payment_screenshot_observation", actionId: "observe" });
  const sibling = task({ jobId: "job:untouched", productId: "payment_screenshot_observation", actionId: "observe" });
  store.acceptTask(base, "attempt:output"); store.acceptTask(sibling, "attempt:sibling");
  const abort = new AbortController();
  let finish!: () => void;
  state.activeAbort.set(base.job_id, abort);
  state.active.set(base.job_id, new Promise<void>(resolve => { finish = resolve; }).then(() => {
    assert.equal(abort.signal.aborted, true);
    store.preserveCompleteOutput(base.job_id, "attempt:output", { payload: { late: true }, evidence_refs: [] }, []);
    order.push("writer");
  }).finally(() => { state.active.delete(base.job_id); order.push("finally"); }));
  state.evidenceStore.deleteArtifactsForMission = async () => { order.push("forensics"); };
  const deleting = purgeDeletedJob(state, base.job_id);
  await Promise.resolve(); assert.deepEqual(order, []); assert.ok(store.readTask(base.job_id));
  finish(); await deleting;
  assert.deepEqual(order, ["writer", "finally", "release", "browser", "forensics"]);
  assert.equal(store.readTask(base.job_id), null); assert.ok(store.readTask(sibling.job_id));
  assert.equal((await readdir(path.join(directory, "plugin-tasks", "production-runtime"))).includes(base.job_id), false);
  for (const error of [runtimeTransportFailure("AI_V6_JOB_NOT_FOUND", 403),
    runtimeTransportFailure("NOT_FOUND", 404), runtimeTransportFailure("AI_V6_JOB_DEVICE_NOT_VISIBLE", 404),
    executionFailure("failed", "AI_V6_JOB_NOT_FOUND")]) assert.equal(websiteJobAbsent(error), false);
  assert.equal(websiteJobAbsent(runtimeTransportFailure("AI_V6_JOB_NOT_FOUND", 404)), true);
  store.close();
};

const verifyCancelledUnadoptedClaim = async (temporary: string): Promise<void> => {
  const directory = path.join(temporary, "cancelled-unadopted"); await mkdir(directory);
  const store = new ProductionRuntimeStore(directory), state = retirementState(store, directory);
  const base = task({ jobId: "job:cancelled-unadopted", productId: "payment_screenshot_observation", actionId: "observe",
    extra: { parameters: { observation_schema_version: "payment-screenshot-observation-v1" } },
    materialRefs: ["payment_screenshot", "result_contract"].map((role, ordinal) => ({
      material_id: `material:${role}`, ordinal, role, display_name: `input:${role}`, object_ref: `object:${role}`,
      sha256: HASH_A, bytes: 2, media_type: ordinal === 0 ? "image/png" : "application/json",
      storage_class: "private_owner_scoped", owner_scope_hash: HASH_A,
      trust_class: ordinal === 0 ? "transport_evidence" : "instruction", may_issue_instruction: ordinal === 1,
    })) });
  const job = claimTask(base); state.activeAbort.set(job.job_id, new AbortController());
  const remote = await deviceStatusWithoutAdmission(job.job_id, true).request();
  state.session.request = async pathname => {
    assert.ok(pathname.endsWith("/device-status"), "known cancellation must not require a live lease or perform Product writes");
    return { ...remote, control_intent: { ...remote.control_intent, reason_code: "ADMIN_AI_WORK_ORDER_REPLACEMENT" } };
  };
  await executeClaim(state, job);
  assert.equal(store.readTask(job.job_id)?.current_attempt_id, job.grant.attempt_id,
    `${state.lastErrorCode}:${state.lastErrorReason}`);
  assert.equal(state.activeAbort.get(job.job_id)!.signal.aborted, true);
  await store.purgeJob(job.job_id);
  store.acceptTask(base, "attempt:output"); const source = zeroInputSeal(store, base); store.sealSourceHandoff(source);
  const regrant = ClaimedProductionTaskSchema.parse({ ...job,
    grant: { ...job.grant, source_handoff_seal_hash: source.seal_hash } });
  state.activeAbort.set(job.job_id, new AbortController());
  await executeClaim(state, regrant);
  assert.equal(store.readTask(job.job_id)?.current_attempt_id, regrant.grant.attempt_id,
    "the cancelled current grant must adopt its already signed original predecessor seal without Product or renew");
  store.close();
};

export const verifyRuntimeRetirementMechanics = async (temporary: string): Promise<void> => {
  await verifyAllStatePaging(temporary);
  await verifyPurgeJoinsRealWriter(temporary);
  await verifyCancelledUnadoptedClaim(temporary);
  await verifyCompletedAndUnknownRetirement(temporary);
};

export const verifySourceTransportGates = async (): Promise<void> => {
  const temporary = await mkdtemp(path.join(tmpdir(), "source-transport-"));
  try {
    for (const mode of ["browser-absent", "executor-full", "n-full", "cooldown", "draining", "ledger-invalid"] as const) {
      await verifyOriginalSourceTransport(temporary, mode);
    }
  } finally { await rm(temporary, { recursive: true, force: true }); }
};

const sourceTransportFetch = (state: RuntimeState, batches: string[][],
  fault: { unexpectedGrant: boolean; statusJobIds: string[]; cancelledDelivery: boolean }): typeof fetch => {
  let generation = 1, sequence = 0;
  const credential = () => ({ schema_version: "xuanxue-ai-worker-session-credential.v6",
    worker_session_id: "session:retirement", worker_session_epoch: 1, token: `aisc_v6_${"t".repeat(40)}`,
    token_generation: generation, issued_at: new Date().toISOString(), expires_at: "2099-01-01T00:00:00.000Z",
    previous_generation_valid_until: null });
  return async (input, init) => {
    const pathname = new URL(String(input)).pathname, body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    let data: unknown;
    if (pathname.endsWith("/sessions/open")) data = { session: { device_id: validDeviceCredential.device_id,
      worker_session_id: "session:retirement", worker_session_epoch: 1, control_contract_version: 49, attestation_seq: sequence },
      session_credential: credential() };
    else if (pathname.endsWith("/heartbeat")) {
      sequence++; generation++;
      assert.equal(body.drain_state, state.draining ? "draining" : "open");
      data = { session_credential: credential(), attestation_receipt: {
        schema_version: "xuanxue-ai-runtime-attestation-receipt.v6", receipt_id: `attestation:${sequence}`,
        receipt_hash: hashCanonical(body), worker_session_id: "session:retirement", worker_session_epoch: 1,
        attestation_seq: sequence, payload_hash: hashCanonical(body), server_signature: HASH_A,
        issued_at: new Date().toISOString(), expires_at: "2099-01-01T00:00:00.000Z", claim_eligible: false, reason_codes: [] } };
    } else if (pathname.endsWith("/device-status")) {
      const jobId = decodeURIComponent(pathname.split("/").at(-2)!); fault.statusJobIds.push(jobId);
      data = await deviceStatusWithoutAdmission(jobId, fault.cancelledDelivery,
        "ACTIVE_ATTEMPT", fault.cancelledDelivery ? "ADMIN_AI_WORK_ORDER_REPLACEMENT" : null).request();
    } else if (pathname.includes("/artifacts/")) {
      const bytes = Buffer.from(init!.body as Uint8Array), hash = sha256(bytes);
      data = { schema_version: "xuanxue-ai-material-receipt.v6", state: "staged",
        role: pathname.split("/").at(-2), artifact_id: decodeURIComponent(pathname.split("/").at(-1)!),
        sha256: hash, receipt_hash: hashCanonical({ pathname, hash }), object_ref: `object:${hash}`,
        media_type: "application/json", byte_length: bytes.byteLength };
    } else if (pathname.endsWith("/terminal")) {
      data = { schema_version: "xuanxue-ai-terminal-receipt.v6", job_id: body.job_id,
        terminal_status: "completed", payload_hash: body.payload_hash, failure: null, first_terminal: true,
        device_id: validDeviceCredential.device_id, device_epoch: validDeviceCredential.device_epoch,
        worker_session_id: "session:retirement", worker_session_epoch: 1,
        runtime_attestation_receipt_hash: HASH_A };
    }
    else if (pathname.endsWith("/jobs/claim")) {
      const sources = body.source_evidence as SourceAttemptHandoff[], candidates = body.delivery_candidates as unknown[];
      assert.ok(sources.length > 0 && sources.length + candidates.length <= 6); assert.equal(candidates.length, 0);
      assert.equal(body.runtime_attestation_receipt_hash, state.session.latestAttestation.receipt_hash);
      batches.push(sources.map(source => source.job_id));
      data = { schema_version: "xuanxue-ai-claim-batch-receipt.v6", request_id: body.request_id,
        request_payload_hash: hashCanonical(body), claim_batch_id: `batch:${batches.length}`,
        outcome: state.draining ? "DRAINING" : "CLAIM_BLOCKED", jobs: fault.unexpectedGrant ? [{}] : [],
        server_now: new Date().toISOString(), next_claim_after_ms: 1_000, queue_epoch: 1, reason_codes: [] };
    } else if (pathname.endsWith("/close")) data = {};
    else throw new Error(`UNEXPECTED_SOURCE_TRANSPORT:${pathname}`);
    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "content-type": "application/json" } });
  };
};

const verifyOriginalSourceTransport = async (temporary: string, mode: string): Promise<void> => {
  const directory = path.join(temporary, mode); await mkdir(directory);
  const store = new ProductionRuntimeStore(directory), batches: string[][] = [], seals: SourceAttemptHandoff[] = [];
  let state!: RuntimeState;
  const logger = createRuntimeLogger({ producer: "source-transport", owner: "production-runtime", component: "production-runtime",
    terminalEnabled: false, fileSink: { directoryPath: path.join(directory, "logs") } });
  const session = new ProductionWorkerSession(DeviceCredentialSchema.parse(validDeviceCredential), () => runtimeState(state),
    HASH_A, () => logger.isWritable(), "worker:source-transport");
  state = shutdownRuntimeFixture({ store, dataDir: directory, session, runtimeLogger: logger, browser: {
    readProductionRuntimeState: () => ({ browserAuthorityState: mode === "browser-absent" ? "absent" : "present", browserTargetState: "absent" }),
  } });
  for (let index = 0; index < 7; index++) {
    const base = task({ jobId: `job:transport:${index}`, productId: "payment_screenshot_observation", actionId: "observe" });
    store.acceptTask(base, "attempt:output"); const seal = zeroInputSeal(store, base); store.sealSourceHandoff(seal); seals.push(seal);
  }
  if (mode === "n-full") for (let index = 0; index < 6; index++) {
    const base = task({ jobId: `job:active:${index}`, productId: "payment_screenshot_observation", actionId: "observe" });
    store.acceptTask(base, "attempt:active"); state.active.set(base.job_id, new Promise<void>(() => {}));
  }
  if (mode === "executor-full") state.executor.availableCapacity = () => 0;
  if (mode === "cooldown") state.providerRateLimitControl.canRequestClaimAuthority = () => false;
  if (mode === "ledger-invalid") store.isLedgerConsistent = () => false;
  state.draining = mode === "draining";
  if (state.draining) {
    state.drainJobIds = new Set(seals.map(source => source.job_id));
  }
  const originalFetch = globalThis.fetch, fault = { unexpectedGrant: false, statusJobIds: [] as string[], cancelledDelivery: false };
  globalThis.fetch = sourceTransportFetch(state, batches, fault);
  try {
    if (mode === "draining") {
      state.draining = false;
      for (const delivery of ["ordinary", "cancelled-output", "cancelled-staged"]) {
        fault.cancelledDelivery = delivery !== "ordinary"; await verifyUnstagedCompleteDelivery(state, delivery);
      }
      fault.cancelledDelivery = false; state.draining = true;
      fault.statusJobIds.length = 0;
    }
    let passes = 0; await workerLoop(state, () => { if (++passes === 2) state.abort.abort(); });
    if (mode === "ledger-invalid") assert.equal(batches.length, 0, "source transport retains the original shared ledger safety gate");
    else assert.equal(new Set(batches.flat()).size, 7, `${mode}:${state.lastErrorCode}:${state.lastErrorReason}`);
    if (mode === "draining") {
      assert.equal(fault.statusJobIds.includes("job:unobserved-history"), false, "shutdown scans only its existing finite drain denominator");
      state.draining = false; await session.heartbeat();
      const queued = session.requestClaim("claim:queued-source", 1, false, [seals[0]!], []); state.draining = true;
      assert.equal(ClaimBatchReceiptSchema.parse(await queued).outcome, "DRAINING", "a queued source uses a fresh real draining attestation");
      const count = batches.length;
      await assert.rejects(session.requestClaim("claim:empty-source", 1), /PRODUCTION_CLAIM_STOPPED/u);
      await assert.rejects(session.request("/internal/ai-production/v6/jobs/claim", { method: "POST",
        body: JSON.stringify({ source_evidence: [seals[0]] }) }), /PRODUCTION_CLAIM_STOPPED/u);
      assert.equal(batches.length, count, "nonempty text alone cannot bypass the physical draining gate");
      fault.unexpectedGrant = true;
      await assert.rejects(session.requestClaim("claim:unexpected-grant", 1, true, [seals[0]!], []), /V6_DRAINING_CLAIM_GRANTED/u);
    }
    assert.equal(store.sealedSourceHandoffJobIds().length, 7, "transport preserves each original seal until authenticated absence");
  } finally { state.active.clear(); await session.close(); store.close(); globalThis.fetch = originalFetch; }
};

const verifyUnstagedCompleteDelivery = async (state: RuntimeState, delivery: string): Promise<void> => {
  await state.session.open();
  const base = task({ jobId: delivery === "ordinary" ? "job:unobserved-history" : `job:${delivery}`,
    productId: "payment_screenshot_observation", actionId: "observe" });
  const original = claimTask(base), session = state.session;
  const binding = { worker_session_id: session.workerSessionId, worker_session_epoch: session.workerSessionEpoch,
    device_id: validDeviceCredential.device_id, device_epoch: validDeviceCredential.device_epoch };
  const job = ClaimedProductionTaskSchema.parse({ ...original, lease_owner: binding.device_id,
    grant: { ...original.grant, ...binding, same_accepted_attempt: true, delivery_only: true,
      execution_fence: { ...original.grant.execution_fence, ...binding } } });
  state.store.acceptTask(base, job.grant.attempt_id);
  const preserved = state.store.preserveCompleteOutput(base.job_id, job.grant.attempt_id,
    { payload: { original: "原文\\n", nested: { z: 1, a: 2 } }, evidence_refs: ["forensics:preserved"] }, []);
  if (delivery === "cancelled-staged") {
    const uploaded = await uploadProductionResult({ session, store: state.store, job, complete: preserved });
    const terminal = buildTerminalProductionIntent(session, job, { status: "completed", payload_hash: hashCanonical(uploaded.envelope),
      result_receipt_hashes: uploaded.artifact_receipts.map(receipt => receipt.receipt_hash), terminal_source_first_fact_raw: null });
    state.store.markExecuting(job.job_id);
    state.store.stageResultAndEnqueueTerminal({ jobId: job.job_id, attemptId: job.grant.attempt_id,
      result: uploaded.envelope, terminal: terminal.write, websiteStagedArtifactReceipts: uploaded.artifact_receipts });
  }
  state.executor.execute = async () => { throw new Error("DELIVERY_ONLY_PRODUCT_FORBIDDEN"); };
  state.activeAbort.set(job.job_id, new AbortController());
  await executeClaim(state, job);
  assert.equal(state.activeAbort.get(job.job_id)!.signal.aborted, delivery !== "ordinary");
  const completed = state.store.readTask(job.job_id)!;
  assert.equal(completed.status, "completed", `${state.lastErrorCode}:${state.lastErrorReason}`);
  assert.equal(completed.result!.result_payload_hash, sha256(Buffer.from(preserved.payload_json)));
  assert.equal(completed.result!.execution_receipt_hash, preserved.execution_receipt_hash);
  assert.deepEqual(completed.result!.evidence_refs, preserved.evidence_refs);
  assert.deepEqual(state.store.readCompleteOutput(job.job_id, job.grant.attempt_id), preserved);
  assert.ok(state.store.readResultReceivingReceipt(job.job_id, job.grant.attempt_id, completed.result!));
  assert.equal(state.store.isLedgerConsistent(new Set()), true);
  state.store.settleBrowserCleanup(job.job_id); state.activeAbort.delete(job.job_id);
};

const verifyCompletedAndUnknownRetirement = async (temporary: string): Promise<void> => {
  const directory = path.join(temporary, "source-retirement"); await mkdir(directory);
  const store = new ProductionRuntimeStore(directory);
  const jobs = ["completed", "unknown", "slot"].map(kind => task({ jobId: `job:retire-${kind}`,
    productId: "payment_screenshot_observation", actionId: "observe" }));
  for (const base of jobs) store.acceptTask(base, "attempt:output");
  const url = "https://chatgpt.com/c/retirement-fixture", user = "user:retirement-fixture";
  const effect = { attemptId: "attempt:output", resultRevision: 0, productStepId: "observe", callId: "turn-submit",
    childCapabilityId: "submit_exact_gpt_turn_once", sourceEffectSetHash: HASH_A, effectIdentityHash: HASH_A,
    authorityRef: "browser:original", walAuthorityHash: HASH_A, rawWalAuthorityHash: HASH_A,
    anchorState: "trusted" as const, anchorProofHash: HASH_A, rawAnchorProofHash: HASH_A,
    canonicalConversationHash: sha256(Buffer.from(url)), userTurnHash: sha256(Buffer.from(user)),
    state: "CONFIRMED" as const, mutationOutcome: "confirmed" as const, physicalInputCount: 1 };
  const history = { historyHash: hashCanonical(effect), rowCount: 1, walHistoryVerified: true,
    unresolvedCommandCount: 0, unresolvedCommandSetHash: hashCanonical([]), replayEffects: [effect],
    replayCalls: [{ productStepId: effect.productStepId, callId: effect.callId,
      childCapabilityId: effect.childCapabilityId, sourceEffectSetHash: effect.sourceEffectSetHash }] };
  const state = retirementState(store, directory, { readJobBrowserHistoryEvidence: () => history,
    readAttemptPhysicalInputState: () => "possible", readJobPhysicalInputState: () => "possible" });
  for (const base of [jobs[0]!, jobs[2]!]) recordSourceCheckpoint({ store, browserAuthority: state.browserAuthority, jobId: base.job_id, attemptId: "attempt:output",
    checkpoint: { providerEffectIdentityHash: HASH_A, browserAuthorityHash: HASH_A, browserAuthorityRef: `browser-source:${HASH_A}`,
      sourceAttemptId: "attempt:output", sourceResultRevision: 0, checkpointExactCallIdentityHash: HASH_A,
      artifactRef: "forensics:original", artifactContentHash: HASH_A, submitPromptHash: HASH_A,
      canonicalConversationUrl: url, userTurnId: user } });
  let artifactChecks = 0;
  state.executor.verifySourceCheckpointArtifact = async () => { artifactChecks++; };
  const original = store.preserveCompleteOutput(jobs[0]!.job_id, "attempt:output",
    { payload: { complete: true }, evidence_refs: ["forensics:original"] }, []);
  const payload = Buffer.from(original.payload_json, "utf8"), fixtureResult = resultFor(jobs[0]!);
  const result = { ...fixtureResult, execution_receipt_hash: original.execution_receipt_hash,
    result_payload_hash: sha256(payload), result_payload_bytes: payload.byteLength, evidence_refs: original.evidence_refs,
    result_object_receipt: { ...fixtureResult.result_object_receipt, sha256: sha256(payload), bytes: payload.byteLength } };
  const receipt = stageResultForAcceptance(store, jobs[0]!.job_id, "attempt:output", result);
  store.hydrateRemoteOutboxReceipts(jobs[0]!.job_id, [receipt]); store.completeTask(jobs[0]!.job_id, result);
  const before = store.readTask(jobs[0]!.job_id);
  const slotOutput = store.preserveCompleteOutput(jobs[2]!.job_id, "attempt:output", { payload: { answer: 3 }, evidence_refs: [] }, []);
  const conflict = await seedExactPayloadConflict(store, jobs[2]!.job_id, slotOutput.payload_json);
  const authorities = store.taskAuthorities().map(task => ({ task, control: {
    schema_version: "xuanxue-ai-control-intent.v6" as const, job_id: task.task.job_id,
    control_epoch: 0, intent: "none" as const, reason_code: null as string | null } }));
  assert.deepEqual(await prepareSourceHandoffs(state, [{ task: store.readTask(jobs[2]!.job_id)!, control: {
    ...authorities[0]!.control, job_id: jobs[2]!.job_id, intent: "cancel_requested", control_epoch: 1,
    reason_code: "ADMIN_AI_WORK_ORDER_REPLACEMENT" } }]), [], "a complete output remains protected on retirement even after exact slot 409");
  const ordinary = await prepareSourceHandoffs(state, authorities);
  assert.equal(ordinary.length, 1, "the mature exact 409 source survives; completed and unobserved trusted effects are excluded");
  assert.deepEqual(ordinary[0]!.payload_slot_conflict, conflict);
  assert.deepEqual(store.readCompleteOutput(jobs[2]!.job_id, "attempt:output"), slotOutput);
  const sources = await prepareSourceHandoffs(state, authorities.map(item => ({ ...item,
    control: { ...item.control, intent: "cancel_requested", control_epoch: 1, reason_code: "ADMIN_AI_WORK_ORDER_REPLACEMENT" } })));
  assert.equal(sources.length, 3, `${state.lastErrorCode}:${state.lastErrorReason}`);
  const completed = sources.find(source => source.job_id === jobs[0]!.job_id)!;
  const unknown = sources.find(source => source.job_id === jobs[1]!.job_id)!;
  assert.equal(completed.readback_proofs[0]!.disposition, "settled_reusable");
  assert.equal(completed.readback_exhaustion_hash, hashCanonical([])); assert.ok(artifactChecks > 0);
  assert.deepEqual(store.readTask(jobs[0]!.job_id), before);
  assert.deepEqual(store.readCompleteOutput(jobs[0]!.job_id, "attempt:output"), original);
  assert.ok(store.readResultReceivingReceipt(jobs[0]!.job_id, "attempt:output", result));
  assert.equal(store.readResultOutboxHistoryEvidence(jobs[0]!.job_id, "attempt:output").candidateCount, 0);
  assert.equal(unknown.readback_proofs[0]!.disposition, "unresolved");
  assert.deepEqual(unknown.readback_proofs[0]!.effects[0]!.unresolved, {
    source_attempt_id: "attempt:output", source_result_revision: 0, wal_state: "CONFIRMED", mutation_outcome: "confirmed",
    physical_input_count: 1, observed_at: unknown.readback_proofs[0]!.effects[0]!.unresolved!.observed_at, provider_input_delta: 0 });
  assert.throws(() => store.acceptTaskAfterSourceHandoff(jobs[1]!, "attempt:new", unknown.seal_hash),
    /PRODUCTION_SOURCE_HANDOFF_CONFLICT/u, "retirement unknown must never become a recovery grant");
  assert.deepEqual((await prepareSourceHandoffs(state, [])).map(hashCanonical).sort(), sources.map(hashCanonical).sort(),
    "sealed bytes are reused without a new observation");
  store.close();
};

const seedExactPayloadConflict = async (store: ProductionRuntimeStore, jobId: string, payload: string) => {
  const attemptId = "attempt:output", attemptHash = hashCanonical({ attempt_id: attemptId }).slice(7, 23);
  for (const [index, body] of [Buffer.from('{"answer":2}'), Buffer.from(payload)].entries()) {
    const hash = sha256(body);
    const requestId = `aipresult_${hashCanonical({ job_id: jobId, attempt_id: attemptId,
      role: "result_payload", content_hash: hash }).slice(7, 47)}`;
    const artifactId = `airesult_${jobId.replace(/[^A-Za-z0-9_-]/gu, "_").slice(-64)}_${attemptHash}_result_payload_${hash.slice(-16)}`;
    store.enqueue({ idempotency_key: requestId, kind: "artifact", method: "PUT", headers: { "x-ai-content-sha256": hash },
      path: `/internal/ai-production/v6/jobs/${encodeURIComponent(jobId)}/artifacts/result_payload/${artifactId}`, body });
    if (index === 0) {
      const receipt = { role: "result_payload", receipt_hash: HASH_A, sha256: hash, artifact_id: artifactId,
        object_ref: "object:original-payload", media_type: "application/json", byte_length: body.byteLength };
      store.hydrateRemoteOutboxReceipts(jobId, [{ request_id: requestId, write_kind: "artifact",
        payload_hash: hash, response_json: receipt }]);
    } else await assert.rejects(store.deliverOutbox(requestId, async () => {
      throw runtimeTransportFailure("AI_PRODUCTION_RESULT_OBJECT_CONFLICT", 409);
    }), /AI_PRODUCTION_RESULT_OBJECT_CONFLICT/u);
  }
  const conflict = store.readResultPayloadSlotConflict(jobId, attemptId); assert.ok(conflict);
  return conflict;
};

/** Ordinary startup validates the three-table store read-only: no migration, no repair, no silent bootstrap. */
export const verifyOrdinaryStartupRejectsSchemaMigration = async (temporary: string): Promise<void> => {
  await verifyCompleteOutputDurability(temporary);
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
};
