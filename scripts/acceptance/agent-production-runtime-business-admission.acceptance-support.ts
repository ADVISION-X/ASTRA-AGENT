import Database from "better-sqlite3";
import { browserExecutionFailure } from "../../src/lib/browser/browser-authority-api.js";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { executionFailure } from "../../src/lib/execution-failure.js";
import { readProductionDeviceJobStatus } from "../../src/lib/local-runtime/production/cloud-reconciliation-client.js";
import { reconcilePendingAttemptFailures } from "../../src/lib/local-runtime/production/runtime-claim.js";
import { reconcileClaimAttemptFailure } from "../../src/lib/local-runtime/production/runtime-claim-recovery.js";
import { purgeDeletedJob, reconcileBusinessAdmission } from "../../src/lib/local-runtime/production/runtime-business-admission.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { BrowserLaneCoordinator } from "../../src/lib/browser/infrastructure/browser-lane-coordinator.js";
import { identity, exactHash } from "./local-browser-mutation-store-support.js";
import { businessInFlightCount, claimReusesExistingBusinessSlot,
  reconcileCompletedBrowserTargets } from "../../src/lib/local-runtime/production/runtime-loops.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { readProductionOperationsSnapshot } from "../../src/lib/local-runtime/production/operations-snapshot.js";
import {
  HASH_A, HASH_B, HASH_C, attemptFailureFirstFact, claimTask,
  deviceStatusWithoutAdmission, resultFor, stageResultForAcceptance, task,
} from "./agent-production-runtime-fixtures.js";

const readRuntimeSource = (relativePath: string) => readFile(
  new URL(`../../src/lib/local-runtime/production/${relativePath}`, import.meta.url), "utf8",
);

const exerciseOperationsSnapshot = async (): Promise<void> => {
  const operationsTemporary = await mkdtemp(path.join(tmpdir(), "agent-operations-snapshot-"));
  try {
    const snapshot = await readProductionOperationsSnapshot({
      dataDir: operationsTemporary,
      session: {
        workerSessionId: "session:observation",
        async request() {
          return {
            schema_version: "xuanxue-ai-worker-observation.v6",
            observed_at: "2026-09-03T00:00:00.000Z",
            claim_exclusion_counts: [{ reason_code: "NO_UNFINISHED_V6_DEMAND", count: 1 }],
            nearest_retry_not_before: null,
            scope_total: 0,
            scope_truncated: false,
            jobs: [],
          };
        },
      } as never,
      store: {
        outboxAuthorities: () => [],
      } as never,
      browser: {
        hasBrowserMutationForJob: () => false,
        hasUnresolvedBrowserMutation: () => false,
      } as never,
      health: () => ({
        shellState: "ready", cloudState: "ready", browserState: "ready", executionState: "ready",
        claimAdmissionState: "eligible", logSinkState: "ready", browserAuthorityState: "present",
        browserTargetState: "absent", browserLaneState: "idle", controlContractVersion: 21,
        catalogHash: HASH_A, activeCount: 0, pendingOutboxCount: 0, lastSuccessfulHeartbeatAt: null,
        lastErrorCode: null, lastErrorReason: null, checkedAt: "2026-09-03T00:00:00.000Z",
      }),
      jobId: undefined,
    });
    assert.equal(snapshot.rows.find((entry) => entry.axis === "runtime_log_sink")?.current_value, "ready");
    assert.equal(snapshot.rows.some((entry) => ["agent_task", "lease_fence", "checkpoint"].includes(entry.axis)), false);
    assert.equal(snapshot.rows.find((entry) => entry.axis === "runtime_log_evidence")?.completeness,
      "SOURCE_UNAVAILABLE");
    assert.equal(snapshot.rows.find((entry) => entry.axis === "outbox")?.freshness.kind, "snapshot");
  } finally {
    await rm(operationsTemporary, { recursive: true, force: true });
  }
};

const exerciseWaitNewAndPrivacy = async (
  store: ProductionRuntimeStore, productionTask: ReturnType<typeof task>,
): Promise<void> => {
  const waitNew = task({ jobId: "job:admission:wait-new",
    productId: productionTask.product_id, actionId: productionTask.action_id,
    materialRefs: productionTask.material_refs,
    extra: { parameters: productionTask.parameters } });
  store.acceptTask(waitNew, "attempt:wait-new");
  store.markExecuting(waitNew.job_id);
  stageResultForAcceptance(store, waitNew.job_id, "attempt:wait-new", resultFor(waitNew));
  let releasedWaitNewTarget = 0;
  assert.equal(await reconcileBusinessAdmission({
    store,
    session: deviceStatusWithoutAdmission(waitNew.job_id, false, "WAIT_NEW_ATTEMPT"),
    browserAuthority: { releaseJobBoundTarget: async () => {
      releasedWaitNewTarget += 1;
    } },
    abort: new AbortController(),
  } as never, store.readTask(waitNew.job_id)!), "pending");
  assert.equal(releasedWaitNewTarget, 0);
  assert.deepEqual(store.readTask(waitNew.job_id)?.staged_result, resultFor(waitNew),
    "a valid result remains ready while Website admission is reconciled");
  assert.equal(store.readTask(waitNew.job_id)?.current_reason, "RESULT_AUTHORITY_RECONCILIATION_PENDING");
  assert.equal(store.unfinishedExecutionsWithoutReceipt()
    .some((candidate) => candidate.task.job_id === waitNew.job_id), false,
  "the staged result remains in the admission readback queue");
  const privacyClosed = task({ jobId: "job:admission:privacy-closed",
    productId: productionTask.product_id, actionId: productionTask.action_id,
    materialRefs: productionTask.material_refs,
    extra: { parameters: productionTask.parameters } });
  store.acceptTask(privacyClosed, "attempt:privacy-closed");
  store.markExecuting(privacyClosed.job_id);
  stageResultForAcceptance(store, privacyClosed.job_id, "attempt:privacy-closed", resultFor(privacyClosed));
  let privacyReleaseAuthority = "";
  assert.equal(await reconcileBusinessAdmission({
    store,
    session: deviceStatusWithoutAdmission(
      privacyClosed.job_id, false, "WAIT_NEW_ATTEMPT", "PRIVACY_SUBJECT_CLOSED",
    ),
    browserAuthority: { releaseJobBoundTarget: async (_jobId: string, authority: string) => {
      privacyReleaseAuthority = authority;
    } },
    abort: new AbortController(),
  } as never, store.readTask(privacyClosed.job_id)!), "pending");
  assert.equal(privacyReleaseAuthority, "",
    "a diagnostic privacy reason cannot revoke an already valid result");
};

const exerciseDeletionControlIntent = async (
  store: ProductionRuntimeStore, pending: ReturnType<typeof task>,
): Promise<void> => {
  const mislabelled = await readProductionDeviceJobStatus(
    deviceStatusWithoutAdmission(pending.job_id, false, "ACTIVE_ATTEMPT",
      "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED") as never,
    pending.job_id,
  );
  assert.equal(mislabelled.control_intent.intent, "none",
    "a deletion-looking diagnostic reason cannot manufacture Website control intent");
  const controlled = await readProductionDeviceJobStatus(
    deviceStatusWithoutAdmission(pending.job_id, true, "ACTIVE_ATTEMPT",
      "UNRELATED_DIAGNOSTIC") as never,
    pending.job_id,
  );
  assert.equal(controlled.control_intent.intent, "cancel_requested",
    "valid Website control intent survives a mismatched diagnostic reason");
  assert.equal(await reconcileBusinessAdmission({
    store, session: deviceStatusWithoutAdmission(pending.job_id, true), activeAbort: new Map(),
  } as never, store.readTask(pending.job_id)!), "pending");
  assert.equal(store.readTask(pending.job_id)?.current_reason, "RESULT_AUTHORITY_RECONCILIATION_PENDING",
    "cancel_requested is not physical Website absence and cannot authorize local deletion");
};

const exerciseAdmissionDeletion = async (
  store: ProductionRuntimeStore, admissionTemporary: string,
  productionTask: ReturnType<typeof task>, pending: ReturnType<typeof task>,
): Promise<void> => {
  await exerciseDeletionControlIntent(store, pending);
  let browserPurges = 0, evidencePurges = 0, deletionReleaseAuthority = "";
  const browserStore = new BrowserMutationStore(path.join(admissionTemporary, "browser-delete"));
  browserStore.verifyRuntimeTaskProvenance(null);
  browserStore.prepare({ ...identity("admin-deleted-command", "admin-attempt"), jobId: pending.job_id });
  browserStore.prepare({ ...identity("retained-command", "retained-attempt"), jobId: "retained-job" });
  browserStore.markDispatched("admin-deleted-command");
  let lane: BrowserLaneCoordinator;
  lane = new BrowserLaneCoordinator(() => ({ currentOperatorTargetJobRefHash: () => exactHash("retained-job") }) as never,
    { requestPreauthorizedTargetRelease: (jobRefHash: string, authority: string) => {
      assert.equal(jobRefHash, exactHash(pending.job_id)); assert.equal(authority, "website-admin-deletion");
      deletionReleaseAuthority = authority;
      queueMicrotask(() => Reflect.get(lane, "targetAcquirer").resolvePending("release", jobRefHash)); return 1;
    } } as never, { current: () => ({ kind: "PRESENT", authority: { authorityEpoch: 1 } }) } as never,
    { mutationState: browserStore, pendingJobBoundTargetAcquisition: null } as never);
  await purgeDeletedJob({ store, dataDir: admissionTemporary,
    abort: new AbortController(),
    browserAuthority: { releaseJobBoundTarget: lane.releaseJobBoundTarget.bind(lane),
      purgeBrowserJob: (jobId: string, authority: string) => {
        assert.equal(jobId, pending.job_id); assert.equal(authority, "website-admin-deletion");
        lane.purgeJob(jobId, authority as "website-admin-deletion"); browserPurges += 1; } },
    evidenceStore: { deleteArtifactsForMission: async () => { evidencePurges += 1; } },
  } as never, pending.job_id);
  assert.equal(store.readTask(pending.job_id), null);
  assert.equal(browserPurges, 1);
  assert.equal(browserStore.hasMutationForJob(pending.job_id), false);
  assert.equal(browserStore.readCommand("retained-command")?.state, "PREPARED");
  browserStore.close();
  assert.equal(evidencePurges, 1);
  assert.equal(deletionReleaseAuthority, "website-admin-deletion",
    "Website 404 deletion must use the only exact admin-deletion release authority");
  assert.equal(store.pendingBusinessAdmissions().some((row) => row.task.job_id === pending.job_id), false,
    "physical Website absence must remove the existing task and stop admission polling");
  const retryable = task({ jobId: "job:admission:purge-retry",
    productId: productionTask.product_id, actionId: productionTask.action_id,
    materialRefs: productionTask.material_refs,
    extra: { parameters: productionTask.parameters } });
  store.acceptTask(retryable, "attempt:purge-retry");
  store.markExecuting(retryable.job_id);
  stageResultForAcceptance(store, retryable.job_id, "attempt:purge-retry", resultFor(retryable));
  await assert.rejects(purgeDeletedJob({ store, dataDir: admissionTemporary,
    abort: new AbortController(),
    browserAuthority: { releaseJobBoundTarget: async () => undefined,
      purgeBrowserJob: () => undefined },
    evidenceStore: { deleteArtifactsForMission: async () => { throw new Error("FORENSICS_PURGE_FAILED"); } },
  } as never, retryable.job_id), /PRODUCTION_JOB_PURGE_FAILED/u);
  assert.notEqual(store.readTask(retryable.job_id), null,
    "a partial purge must retain the task authority so the same deletion can retry");
  await purgeDeletedJob({ store, dataDir: admissionTemporary,
    abort: new AbortController(),
    browserAuthority: { releaseJobBoundTarget: async () => undefined,
      purgeBrowserJob: () => undefined },
    evidenceStore: { deleteArtifactsForMission: async () => undefined },
  } as never, retryable.job_id);
  assert.equal(store.readTask(retryable.job_id), null);
};

const failureFact = (jobId: string, attemptId: string, overrides: Record<string, unknown>) =>
  attemptFailureFirstFact(attemptId, {
        code: "BROWSER_ATTEMPT_FAILED", mutation_outcome: "confirmed",
        evidence_ref: `browser-fact:${jobId}`, effect_scope: "provider_effect",
        child_capability_id: "submit_exact_gpt_turn_once", browser_outcome: "CONFIRMED",
        provider_effect_identity_hash: HASH_A, settled_result_payload_hash: null,
        stopped_empty_proof: null, child_proof_ref: null, child_proof_hash: null,
        evidence_hash: HASH_B, cause: null, ...overrides,
      } as never);

const exerciseFailureCapacity = async (
  store: ProductionRuntimeStore, productionTask: ReturnType<typeof task>,
): Promise<void> => {
  const readback = task({ jobId: "job:capacity:provider-readback",
    productId: productionTask.product_id, actionId: productionTask.action_id,
    materialRefs: productionTask.material_refs, extra: { parameters: productionTask.parameters } });
  store.acceptTask(readback, "attempt:provider-readback");
  store.recordAttemptFailure(readback.job_id, "attempt:provider-readback",
    failureFact(readback.job_id, "attempt:provider-readback", {}));
  assert.equal(businessInFlightCount({ active: new Map(), store } as never), 2,
    "a durable same-attempt provider readback must retain its existing business slot");
  assert.equal(businessInFlightCount({ active: new Map([[readback.job_id, Promise.resolve()]]), store } as never), 2,
    "a regranted readback execution must reuse the existing slot instead of adding another");
  const readbackClaim = claimTask(readback);
  assert.equal(claimReusesExistingBusinessSlot({ active: new Map(), store } as never, {
    ...readbackClaim, grant: { ...readbackClaim.grant, attempt_id: "attempt:different" },
  }), false, "a provider readback slot must reject a grant for a different attempt");
  const unclassified = task({ jobId: "job:capacity:unclassified-failure",
    productId: productionTask.product_id, actionId: productionTask.action_id,
    materialRefs: productionTask.material_refs, extra: { parameters: productionTask.parameters } });
  store.acceptTask(unclassified, "attempt:unclassified");
  store.recordAttemptFailure(unclassified.job_id, "attempt:unclassified",
    failureFact(unclassified.job_id, "attempt:unclassified", {
      effect_scope: "target_local", browser_outcome: "DISPATCHED",
      provider_effect_identity_hash: null, mutation_outcome: "dispatched",
    }));
  assert.equal(businessInFlightCount({ active: new Map(), store } as never), 3,
    "a fail-closed accepted attempt must remain in the attested business denominator");
  const runtimeLoopsSource = await readRuntimeSource("runtime-loops.ts");
  assert.match(runtimeLoopsSource,
    /availableNewSlots > 0 \|\| hasExistingAttemptRecovery/u,
    "a full business denominator must still permit an existing readback or cooldown attempt to request regrant");
  assert.match(runtimeLoopsSource,
    /requestClaimBatch\([\s\S]{0,80}Math\.max\(1, availableNewSlots\), recoveryOnlyClaim/u,
    "the existing V6 wire minimum must be preserved while attestation keeps new grant capacity at zero");
  assert.match(runtimeLoopsSource,
    /businessInFlightJobIds\(state\)\.has\(job\.job_id\)[\s\S]*!claimReusesExistingBusinessSlot\(state, job\)/u,
    "only an exact readback or paused cooldown regrant may reuse an occupied slot");
};

const exerciseBackgroundDeletionSweep = async (
  admissionTemporary: string, productionTask: ReturnType<typeof task>,
): Promise<void> => {
  const sweepDir = path.join(admissionTemporary, "sweep");
  await mkdir(sweepDir);
  const sweepStore = new ProductionRuntimeStore(sweepDir);
  const deleted = task({ jobId: "job:sweep:deleted", productId: productionTask.product_id,
    actionId: productionTask.action_id, materialRefs: productionTask.material_refs,
    extra: { parameters: productionTask.parameters } });
  const sibling = task({ jobId: "job:sweep:sibling", productId: productionTask.product_id,
    actionId: productionTask.action_id, materialRefs: productionTask.material_refs,
    extra: { parameters: productionTask.parameters } });
  for (const candidate of [deleted, sibling]) {
    const attemptId = `attempt:${candidate.job_id}`;
    sweepStore.acceptTask(candidate, attemptId);
    sweepStore.recordAttemptFailure(candidate.job_id, attemptId,
      failureFact(candidate.job_id, attemptId, {}));
  }
  const observed: string[] = [];
  await reconcilePendingAttemptFailures({ store: sweepStore, dataDir: sweepDir,
    abort: new AbortController(),
    session: { request: async (route: string) => {
      if (route.includes(encodeURIComponent(deleted.job_id))) {
        throw executionFailure("failed", "AI_V6_JOB_NOT_FOUND");
      }
      observed.push(sibling.job_id);
      return deviceStatusWithoutAdmission(sibling.job_id).request();
    } },
    browserAuthority: { releaseJobBoundTarget: async () => {
      throw new Error("SIBLING_UNRESOLVED_WAL");
    } },
  } as never);
  assert.deepEqual(observed, [sibling.job_id],
    "one exact 404 purge failure must not block sibling status recovery scanning");
  assert.equal(sweepStore.readTask(deleted.job_id)?.current_reason, "PRODUCTION_JOB_PURGE_FAILED");
  assert.ok(sweepStore.readTask(deleted.job_id), "failed exact purge must retain its durable identity");
  sweepStore.close();
  const activeDir = path.join(admissionTemporary, "active-404");
  await mkdir(activeDir);
  const activeStore = new ProductionRuntimeStore(activeDir);
  const activeJob = task({ jobId: "job:active:deleted", productId: productionTask.product_id,
    actionId: productionTask.action_id, materialRefs: productionTask.material_refs,
    extra: { parameters: productionTask.parameters } });
  activeStore.acceptTask(activeJob, "attempt:active-deleted");
  activeStore.recordAttemptFailure(activeJob.job_id, "attempt:active-deleted",
    failureFact(activeJob.job_id, "attempt:active-deleted", {}));
  const activeAbort = new AbortController();
  let releaseCalls = 0;
  const activeState = { store: activeStore, dataDir: activeDir, abort: new AbortController(),
    active: new Map([[activeJob.job_id, Promise.resolve()]]),
    activeAbort: new Map([[activeJob.job_id, activeAbort]]),
    session: { request: async () => { throw executionFailure("failed", "AI_V6_JOB_NOT_FOUND"); } },
    browserAuthority: { releaseJobBoundTarget: async () => { releaseCalls += 1; },
      purgeBrowserJob: () => undefined },
    evidenceStore: { deleteArtifactsForMission: async () => undefined },
  };
  await reconcilePendingAttemptFailures(activeState as never);
  assert.equal(activeAbort.signal.aborted, true,
    "background exact 404 must stop an active same-attempt recovery before its next input");
  assert.equal(releaseCalls, 0, "background deletion must wait for the active execution to settle");
  assert.ok(activeStore.readTask(activeJob.job_id), "active execution retains its durable identity until settled");
  activeState.active.delete(activeJob.job_id);
  activeState.activeAbort.delete(activeJob.job_id);
  await reconcilePendingAttemptFailures(activeState as never);
  assert.equal(activeStore.readTask(activeJob.job_id), null,
    "the same exact 404 must finish owner purge after execution settles");
  activeStore.close();
};

const exerciseCompletedAdmissionCleanup = async (
  store: ProductionRuntimeStore, productionTask: ReturnType<typeof task>,
): Promise<void> => {
  let releaseCalls = 0, rejectCleanup!: (error: Error) => void;
  let blockedCleanup: Promise<void> | null = null;
  const abort = new AbortController();
  for (const kind of ["local", "remote", "domain-error"] as const) {
    const accepted = task({ jobId: `job:admission:${kind}`,
      productId: productionTask.product_id, actionId: productionTask.action_id,
      materialRefs: productionTask.material_refs, extra: { parameters: productionTask.parameters } });
    const staged = resultFor(accepted);
    store.acceptTask(accepted, `attempt:${kind}`); store.markExecuting(accepted.job_id);
    const receiving = stageResultForAcceptance(store, accepted.job_id, `attempt:${kind}`, staged);
    if (kind === "local") store.markOutboxSent(receiving.request_id, receiving.response_json);
    const base = deviceStatusWithoutAdmission(accepted.job_id);
    const session = { request: async () => {
      assert.notEqual(kind, "local", "a durable receiving receipt must not wait for another Website request");
      return { ...await base.request(), write_receipts: [receiving],
        business_consumer_error: kind === "domain-error" ? "DOMAIN_CONSUMER_FAILED" : null };
    } };
    assert.equal(await reconcileBusinessAdmission({
      store, session,
      browserAuthority: { releaseJobBoundTarget: async () => { throw new Error("ADMISSION_MUST_NOT_CLEAN_BROWSER"); } },
      abort,
    } as never, store.readTask(accepted.job_id)!), "completed");
    assert.equal(store.readTask(accepted.job_id)?.status, "completed");
    assert.equal(store.pendingBrowserCleanupJobIds().includes(accepted.job_id), true);
    if (kind === "local") blockedCleanup = reconcileCompletedBrowserTargets({
      store, abort, browserAuthority: { releaseJobBoundTarget: async () => {
        releaseCalls += 1; await new Promise<void>((_resolve, reject) => { rejectCleanup = reject; });
      } },
    } as never);
  }
  assert.equal(releaseCalls, 1, "one blocked cleanup cannot prevent the other admissions");
  assert.equal(store.pendingBrowserCleanupJobIds().length, 3);
  rejectCleanup(browserExecutionFailure(new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"))); await blockedCleanup;
  assert.equal(store.pendingBrowserCleanupJobIds().length, 3);
  let retried = 0;
  await reconcileCompletedBrowserTargets({ store, abort,
    browserAuthority: { releaseJobBoundTarget: async () => { retried += 1; } },
  } as never);
  assert.equal(store.pendingBrowserCleanupJobIds().length, 0,
    "one finite iteration settles every eligible original cleanup marker");
  await reconcileCompletedBrowserTargets({ store, abort,
    browserAuthority: { releaseJobBoundTarget: async () => { throw new Error("DUPLICATE_CLEANUP"); } },
  } as never);
  assert.equal(retried, 3);
};

const exercisePendingAdmission = async (
  store: ProductionRuntimeStore, productionTask: ReturnType<typeof task>,
): Promise<ReturnType<typeof task>> => {
  const pending = task({ jobId: "job:admission:pending",
    productId: productionTask.product_id, actionId: productionTask.action_id,
    materialRefs: productionTask.material_refs,
    extra: { parameters: productionTask.parameters } });
  const pendingResult = resultFor(pending);
  store.acceptTask(pending, "attempt:pending");
  store.markExecuting(pending.job_id);
  stageResultForAcceptance(store, pending.job_id, "attempt:pending", pendingResult);
  assert.equal(await reconcileBusinessAdmission({
    store, session: deviceStatusWithoutAdmission(pending.job_id),
  } as never, store.readTask(pending.job_id)!), "pending");
  assert.deepEqual(store.readTask(pending.job_id)?.staged_result, pendingResult,
    "absence of Website admission must preserve the staged result and await Website authority");
  assert.equal(store.readTask(pending.job_id)?.current_reason, "RESULT_AUTHORITY_RECONCILIATION_PENDING");
  assert.equal(businessInFlightCount({ active: new Map(), store } as never), 1,
    "an admission-pending job must retain the only business slot after execution settles");
  assert.equal(businessInFlightCount({ active: new Map([[pending.job_id, Promise.resolve()]]), store } as never), 1,
    "active and admission-pending views of the same job must count once");
  return pending;
};

const exerciseReceivingReceiptBoundary = async (directory: string, productionTask: ReturnType<typeof task>): Promise<void> => {
  const dataDir = path.join(directory, "receipt-boundary"); await mkdir(dataDir);
  let store = new ProductionRuntimeStore(dataDir);
  const candidate = task({ jobId: "job:receipt-boundary", productId: productionTask.product_id,
    actionId: productionTask.action_id, materialRefs: productionTask.material_refs, extra: { parameters: productionTask.parameters } });
  const result = resultFor(candidate); store.acceptTask(candidate, "attempt:receipt");
  const receiving = stageResultForAcceptance(store, candidate.job_id, "attempt:receipt", result);
  const base = deviceStatusWithoutAdmission(candidate.job_id, false, "WAIT_NEW_ATTEMPT");
  const state = (receipt: unknown) => ({ store, session: { request: async () => ({
    ...await base.request(), business_consumer_error: "DOMAIN_FAILED_AFTER_RECEIVING", write_receipts: [receipt],
  }) } }) as never;
  for (const mutation of [{ job_id: "foreign-job" }, { payload_hash: HASH_C },
    { worker_session_id: "foreign-session" }, { worker_session_epoch: 2 }, { failure: {} }]) {
    await assert.rejects(reconcileBusinessAdmission(state({ ...receiving,
      response_json: { ...receiving.response_json, ...mutation } }), store.readTask(candidate.job_id)!));
    assert.equal(store.readTask(candidate.job_id)?.status, "failed");
    assert.deepEqual(store.readTask(candidate.job_id)?.staged_result, result);
  }
  assert.equal(await reconcileBusinessAdmission(state({ ...receiving, request_id: "foreign-request" }),
    store.readTask(candidate.job_id)!), "pending");
  await assert.rejects(reconcileBusinessAdmission(state({ ...receiving, payload_hash: HASH_C }),
    store.readTask(candidate.job_id)!));
  await assert.rejects(reconcileBusinessAdmission({ store, session: { request: async () => {
    throw executionFailure("failed", "CLOUD_TRANSPORT_UNAVAILABLE");
  } } } as never, store.readTask(candidate.job_id)!));
  assert.deepEqual(store.readTask(candidate.job_id)?.staged_result, result);
  const notice = "pending-cooldown";
  store.enqueue({ idempotency_key: notice, kind: "provider_cooldown", method: "POST", headers: {},
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(candidate.job_id)}/provider-cooldown`,
    body: JSON.stringify({ job_id: candidate.job_id }) });
  store.markOutboxSent(receiving.request_id, receiving.response_json);
  store.close(); store = new ProductionRuntimeStore(dataDir);
  const recovered = { store, session: { workerSessionId: "new-session", workerSessionEpoch: 99,
    request: async () => { throw new Error("DURABLE_RECEIVING_MUST_NOT_WAIT_FOR_DOMAIN"); } } } as never;
  assert.equal(await reconcileBusinessAdmission(recovered, store.readTask(candidate.job_id)!), "completed");
  assert.equal(await reconcileBusinessAdmission(recovered, store.readTask(candidate.job_id)!), "completed");
  assert.equal(store.readOutboxAuthority(notice)?.lastError, null, "completion cannot swallow a pending provider notice");
  assert.equal(store.readOutboxAuthority(notice)?.state, "pending");
  assert.deepEqual(store.readTask(candidate.job_id)?.result, result);
  store.close();
};

const exerciseWebsiteRefusedResult = async (
  admissionTemporary: string, productionTask: ReturnType<typeof task>,
): Promise<void> => {
  const directory = path.join(admissionTemporary, "historical-refusal"); await mkdir(directory);
  let store = new ProductionRuntimeStore(directory);
  const refused = task({ jobId: "job:refused:domain", productId: productionTask.product_id,
    actionId: productionTask.action_id, materialRefs: productionTask.material_refs,
    extra: { parameters: productionTask.parameters } });
  store.acceptTask(refused, "attempt:refused-1");
  const receiving = stageResultForAcceptance(store, refused.job_id, "attempt:refused-1", resultFor(refused));
  const history = store.readResultOutboxHistoryEvidence(refused.job_id, "attempt:refused-1");
  store.close();
  const db = new Database(path.join(directory, "production-runtime.sqlite"));
  db.prepare("update production_tasks set staged_result_json=null,attempt_failure_json=null,current_reason='WEBSITE_REFUSED_RESULT' where job_id=?").run(refused.job_id);
  db.prepare("update production_outbox set last_error='WEBSITE_ATTEMPT_REPLACED' where idempotency_key=?").run(receiving.request_id);
  db.close(); store = new ProductionRuntimeStore(directory);
  assert.equal(store.attemptClosedByWebsite(refused.job_id, "attempt:refused-1"), true);
  const next = claimTask(refused);
  const recovery = await reconcileClaimAttemptFailure({ store } as never,
    { ...next, grant: { ...next.grant, attempt_id: "attempt:refused-2", same_accepted_attempt: false } },
    { attempt_failure: null } as never, "historical-refusal", async () => undefined);
  assert.equal(recovery.stopBeforeProduct, false);
  assert.equal(store.acceptTask(refused, "attempt:refused-2").current_attempt_id, "attempt:refused-2");
  assert.deepEqual(store.readResultOutboxHistoryEvidence(refused.job_id, "attempt:refused-1"), history);
  store.assertStartupDataIntegrity();
  for (const jobId of ["provider-level", "unclosed"]) {
    const candidate = { ...refused, job_id: jobId };
    store.acceptTask(candidate, "attempt:original");
    if (jobId === "provider-level") store.recordAttemptFailure(jobId, "attempt:original",
      failureFact(jobId, "attempt:original", {}));
    assert.equal(store.attemptClosedByWebsite(jobId, "attempt:original"), false);
    assert.throws(() => store.acceptTask(candidate, "attempt:new"), /PRODUCTION_SOURCE_HANDOFF_REQUIRED/u);
  }
  store.close();
};

export const exerciseOperationsAndBusinessAdmission = async (
  productionTask: ReturnType<typeof task>,
): Promise<void> => {
  await exerciseOperationsSnapshot();

  const admissionTemporary = await mkdtemp(path.join(tmpdir(), "agent-business-admission-"));
  try {
    const store = new ProductionRuntimeStore(admissionTemporary);
    await exerciseCompletedAdmissionCleanup(store, productionTask);
    const pending = await exercisePendingAdmission(store, productionTask);
    await exerciseFailureCapacity(store, productionTask);
    await exerciseBackgroundDeletionSweep(admissionTemporary, productionTask);
    await exerciseWaitNewAndPrivacy(store, productionTask);
    await exerciseReceivingReceiptBoundary(admissionTemporary, productionTask);
    await exerciseWebsiteRefusedResult(admissionTemporary, productionTask);
    await exerciseAdmissionDeletion(store, admissionTemporary, productionTask, pending);
    store.close();
  } finally {
    await rm(admissionTemporary, { recursive: true, force: true });
  }

};
