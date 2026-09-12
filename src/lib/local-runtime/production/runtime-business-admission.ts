import { executionFailure } from "../../execution-failure.js";
import { failureCode } from "../../execution-failure.js";
import { hashCanonical } from "./contracts.js";
import { readProductionDeviceJobStatus } from "./cloud-reconciliation-client.js";
import type { RuntimeState } from "./runtime-state.js";
import type { StoredProductionTask } from "./store.js";
import { purgeProductionRuntimeTask } from "./runtime-storage-inventory.js";

export const websiteJobAbsent = (error: unknown): boolean => {
  const code = failureCode(error, "");
  return code === "AI_V6_DEVICE_JOB_NOT_FOUND"
    || code === "AI_V6_JOB_NOT_FOUND"
    || code === "AI_PRODUCTION_JOB_NOT_FOUND";
};

export const purgeDeletedJob = async (state: RuntimeState, jobId: string): Promise<void> => {
  try {
    state.browserAuthority.purgeBrowserJob(jobId);
    await state.evidenceStore.deleteArtifactsForMission(jobId);
    await purgeProductionRuntimeTask(state.dataDir, jobId);
    await state.store.purgeJob(jobId);
  } catch (error) {
    throw executionFailure("failed", "PRODUCTION_JOB_PURGE_FAILED", { cause: error });
  }
};

export const reconcileBusinessAdmission = async (
  state: RuntimeState,
  record: StoredProductionTask,
): Promise<"completed" | "pending" | "deleted"> => {
  const staged = record.staged_result;
  if (!staged) return record.status === "completed" ? "completed" : "pending";
  let remote: Awaited<ReturnType<typeof readProductionDeviceJobStatus>>;
  try {
    remote = await readProductionDeviceJobStatus(state.session, record.task.job_id);
  } catch (error) {
    if (!websiteJobAbsent(error)) throw error;
    await purgeDeletedJob(state, record.task.job_id);
    return "deleted";
  }
  const admission = remote.business_admission_receipt;
  if (!admission) {
    state.store.setCurrentReason(
      record.task.job_id,
      remote.business_consumer_error
        ? `BUSINESS_ADMISSION_FAILED:${remote.business_consumer_error}`
        : "BUSINESS_ADMISSION_PENDING",
    );
    return "pending";
  }
  if (remote.terminal_payload_hash !== hashCanonical(staged)
    || admission.result_payload_hash !== staged.result_payload_hash) {
    throw executionFailure("failed", "BUSINESS_ADMISSION_RESULT_HASH_MISMATCH");
  }
  state.store.completeTask(record.task.job_id, staged);
  return "completed";
};
