import type { Stats } from "node:fs";
import { lstat, rm } from "node:fs/promises";

import { executionFailure } from "../../execution-failure.js";
import { failureCode } from "../../execution-failure.js";
import { hashCanonical } from "./contracts.js";
import { readProductionDeviceJobStatus } from "./cloud-reconciliation-client.js";
import type { RuntimeState } from "./runtime-state.js";
import type { StoredProductionTask } from "./store.js";
import { productionRuntimeTaskPath } from "./runtime-storage-inventory.js";

const nativeCode = (error: unknown): string | null =>
  error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code : null;

const purgeProductionRuntimeTask = async (dataDir: string, jobId: string): Promise<void> => {
  const taskPath = productionRuntimeTaskPath(dataDir, jobId);
  let metadata: Stats;
  try { metadata = await lstat(taskPath); }
  catch (error) {
    if (nativeCode(error) === "ENOENT") return;
    throw executionFailure("failed", "PRODUCTION_STORAGE_PURGE_UNREADABLE", { cause: error });
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw executionFailure("failed", "PRODUCTION_STORAGE_PURGE_STRUCTURE_INVALID");
  }
  try { await rm(taskPath, { recursive: true, force: false }); }
  catch (error) { throw executionFailure("failed", "PRODUCTION_STORAGE_PURGE_FAILED", { cause: error }); }
  try {
    await lstat(taskPath);
    throw executionFailure("failed", "PRODUCTION_STORAGE_PURGE_INCOMPLETE");
  } catch (error) {
    if (nativeCode(error) !== "ENOENT") throw error;
  }
};

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
