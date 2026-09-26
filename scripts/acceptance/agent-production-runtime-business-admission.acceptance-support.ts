import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { executionFailure } from "../../src/lib/execution-failure.js";
import { readProductionDeviceJobStatus } from "../../src/lib/local-runtime/production/cloud-reconciliation-client.js";
import { reconcilePendingAttemptFailures } from "../../src/lib/local-runtime/production/runtime-claim.js";
import { purgeDeletedJob, reconcileBusinessAdmission } from "../../src/lib/local-runtime/production/runtime-business-admission.js";
import { businessInFlightCount, claimReusesExistingBusinessSlot,
  reconcileCompletedBrowserTargets } from "../../src/lib/local-runtime/production/runtime-loops.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { readProductionOperationsSnapshot } from "../../src/lib/local-runtime/production/operations-snapshot.js";
import {
  HASH_A, HASH_B, admissionReceiptFor, attemptFailureFirstFact, claimTask, deviceStatusWithAdmission,
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
  let waitNewReleaseAuthority = "";
  assert.equal(await reconcileBusinessAdmission({
    store,
    session: deviceStatusWithoutAdmission(waitNew.job_id, false, "WAIT_NEW_ATTEMPT"),
    browserAuthority: { releaseJobBoundTarget: async (_jobId: string, authority: string) => {
      releasedWaitNewTarget += 1;
      waitNewReleaseAuthority = authority;
    } },
    abort: new AbortController(),
  } as never, store.readTask(waitNew.job_id)!), "pending");
  assert.equal(releasedWaitNewTarget, 0);
  assert.equal(waitNewReleaseAuthority, "");
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

const exerciseAdmissionDeletion = async (
  store: ProductionRuntimeStore, admissionTemporary: string,
  productionTask: ReturnType<typeof task>, pending: ReturnType<typeof task>,
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
  assert.equal(store.readTask(pending.job_id)?.current_reason, "BUSINESS_ADMISSION_PENDING",
    "cancel_requested is not physical Website absence and cannot authorize local deletion");
  let browserPurges = 0, evidencePurges = 0, deletionReleaseAuthority = "";
  await purgeDeletedJob({ store, dataDir: admissionTemporary,
    abort: new AbortController(),
    browserAuthority: { releaseJobBoundTarget: async (_jobId: string, authority: string) => {
      deletionReleaseAuthority = authority;
    },
      purgeBrowserJob: () => { browserPurges += 1; } },
    evidenceStore: { deleteArtifactsForMission: async () => { evidencePurges += 1; } },
  } as never, pending.job_id);
  assert.equal(store.readTask(pending.job_id), null);
  assert.equal(browserPurges, 1);
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
  for (const kind of ["base", "bazi", "review"] as const) {
    const accepted = task({ jobId: `job:admission:${kind}`,
      productId: productionTask.product_id, actionId: productionTask.action_id,
      materialRefs: productionTask.material_refs,
      extra: { parameters: productionTask.parameters } });
    const staged = resultFor(accepted);
    store.acceptTask(accepted, `attempt:${kind}`);
    store.markExecuting(accepted.job_id);
    stageResultForAcceptance(store, accepted.job_id, `attempt:${kind}`, staged);
    const typedReceipt = admissionReceiptFor(accepted.job_id, staged.result_payload_hash,
      kind === "bazi" ? {
        bazi_domain_admission_receipt_hash: HASH_A,
        delivery_manifest_id: "delivery-manifest:1",
        delivery_manifest_hash: HASH_B,
      } : kind === "review" ? { review_receipt_hash: HASH_A } : {});
    let releaseCalls = 0;
    assert.equal(await reconcileBusinessAdmission({
      store,
      session: deviceStatusWithAdmission(typedReceipt, accepted.job_id, hashCanonical(staged)),
      browserAuthority: { releaseJobBoundTarget: async () => {
          releaseCalls += 1;
          if (kind === "review") throw new Error("BROWSER_TARGET_CLEANUP_FAILED");
        } },
      abort: new AbortController(),
    } as never, store.readTask(accepted.job_id)!), "completed");
    assert.equal(releaseCalls, 1,
      "parked Target and true absence must both use the Browser release readback");
    assert.equal(store.readTask(accepted.job_id)?.status, "completed");
    assert.equal(store.pendingBrowserCleanupJobIds().includes(accepted.job_id),
      kind === "review", "failed release must keep the completed job in cleanup retry");
  }
  const cleanupJob = "job:admission:review";
  await reconcileCompletedBrowserTargets({ store, abort: new AbortController(),
    browserAuthority: {
      releaseJobBoundTarget: async () => { throw new Error("BROWSER_TARGET_CLEANUP_FAILED"); } },
  } as never);
  assert.deepEqual(store.pendingBrowserCleanupJobIds(), [cleanupJob],
    "failed background release must preserve the pending cleanup");
  let retried = 0;
  await reconcileCompletedBrowserTargets({ store, abort: new AbortController(),
    browserAuthority: { releaseJobBoundTarget: async () => { retried += 1; } },
  } as never);
  assert.equal(retried, 1);
  assert.equal(store.pendingBrowserCleanupJobIds().includes(cleanupJob), false,
    "verified released or absent reply settles the existing cleanup state");
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
  assert.equal(store.readTask(pending.job_id)?.current_reason, "BUSINESS_ADMISSION_PENDING");
  assert.equal(businessInFlightCount({ active: new Map(), store } as never), 1,
    "an admission-pending job must retain the only business slot after execution settles");
  assert.equal(businessInFlightCount({ active: new Map([[pending.job_id, Promise.resolve()]]), store } as never), 1,
    "active and admission-pending views of the same job must count once");
  return pending;
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
    await exerciseAdmissionDeletion(store, admissionTemporary, productionTask, pending);
    store.close();
  } finally {
    await rm(admissionTemporary, { recursive: true, force: true });
  }

};
