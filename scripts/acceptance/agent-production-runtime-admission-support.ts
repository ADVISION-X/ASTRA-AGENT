import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { purgeDeletedJob, reconcileBusinessAdmission }
  from "../../src/lib/local-runtime/production/runtime-business-admission.js";
import { businessInFlightCount } from "../../src/lib/local-runtime/production/runtime-loops.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { readProductionOperationsSnapshot }
  from "../../src/lib/local-runtime/production/operations-snapshot.js";
import {
  HASH_A, HASH_B, admissionReceiptFor, deviceStatusWithAdmission,
  deviceStatusWithoutAdmission, resultFor, task,
} from "./agent-production-runtime-fixtures.js";

export const exerciseOperationsAndBusinessAdmission = async (
  productionTask: ReturnType<typeof task>,
): Promise<void> => {
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
  
  const admissionTemporary = await mkdtemp(path.join(tmpdir(), "agent-business-admission-"));
  try {
    const store = new ProductionRuntimeStore(admissionTemporary);
    for (const kind of ["base", "bazi", "review"] as const) {
      const accepted = task({ jobId: `job:admission:${kind}`,
        productId: productionTask.product_id, actionId: productionTask.action_id,
        materialRefs: productionTask.material_refs,
        extra: { parameters: productionTask.parameters } });
      const staged = resultFor(accepted);
      store.acceptTask(accepted, `attempt:${kind}`);
      store.stageResult(accepted.job_id, staged);
      const typedReceipt = admissionReceiptFor(accepted.job_id, staged.result_payload_hash,
        kind === "bazi" ? {
          bazi_domain_admission_receipt_hash: HASH_A,
          delivery_manifest_id: "delivery-manifest:1",
          delivery_manifest_hash: HASH_B,
        } : kind === "review" ? { review_receipt_hash: HASH_A } : {});
      assert.equal(await reconcileBusinessAdmission({
        store,
        session: deviceStatusWithAdmission(typedReceipt, accepted.job_id, hashCanonical(staged)),
        browserAuthority: { releaseJobBoundTarget: async () => undefined },
        abort: new AbortController(),
      } as never, store.readTask(accepted.job_id)!), "completed");
      assert.equal(store.readTask(accepted.job_id)?.status, "completed");
    }
    const pending = task({ jobId: "job:admission:pending",
      productId: productionTask.product_id, actionId: productionTask.action_id,
      materialRefs: productionTask.material_refs,
      extra: { parameters: productionTask.parameters } });
    const pendingResult = resultFor(pending);
    store.acceptTask(pending, "attempt:pending");
    store.stageResult(pending.job_id, pendingResult);
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
    const waitNew = task({ jobId: "job:admission:wait-new",
      productId: productionTask.product_id, actionId: productionTask.action_id,
      materialRefs: productionTask.material_refs,
      extra: { parameters: productionTask.parameters } });
    store.acceptTask(waitNew, "attempt:wait-new");
    store.stageResult(waitNew.job_id, resultFor(waitNew));
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
    assert.equal(releasedWaitNewTarget, 1);
    assert.equal(waitNewReleaseAuthority, "wait-new-attempt",
      "ordinary WAIT_NEW_ATTEMPT must not acquire the permanent cleanup exception");
    assert.equal(store.readTask(waitNew.job_id)?.staged_result, null,
      "Website WAIT_NEW_ATTEMPT must release only the old local admission-pending attempt");
    assert.equal(store.readTask(waitNew.job_id)?.current_reason, "WAIT_NEW_ATTEMPT");
    const privacyClosed = task({ jobId: "job:admission:privacy-closed",
      productId: productionTask.product_id, actionId: productionTask.action_id,
      materialRefs: productionTask.material_refs,
      extra: { parameters: productionTask.parameters } });
    store.acceptTask(privacyClosed, "attempt:privacy-closed");
    store.stageResult(privacyClosed.job_id, resultFor(privacyClosed));
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
    assert.equal(privacyReleaseAuthority, "website-permanent-revocation",
      "only Website's persisted permanent privacy decision may acquire the revocation exception");
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
    store.stageResult(retryable.job_id, resultFor(retryable));
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
    store.close();
  } finally {
    await rm(admissionTemporary, { recursive: true, force: true });
  }
  
};

