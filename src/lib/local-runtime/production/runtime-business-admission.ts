import type { Stats } from "node:fs";
import { lstat, rm } from "node:fs/promises";

import { executionFailure } from "../../execution-failure.js";
import { failureCode } from "../../execution-failure.js";
import { readProductionDeviceJobStatus, type RemoteProductionDeviceJobStatus } from "./cloud-reconciliation-client.js";
import type { RuntimeState } from "./runtime-state.js";
import type { StoredProductionTask } from "./store.js";
import { productionRuntimeTaskPath } from "./runtime-storage-inventory.js";
import { typedRuntimeTransportFailure } from "./transport-failure.js";

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
  const transport = typedRuntimeTransportFailure(error);
  return transport?.httpStatus === 404 && (transport.code === "AI_V6_JOB_NOT_FOUND"
    || transport.code === "AI_PRODUCTION_JOB_NOT_FOUND");
};

/** Only the original worker calls cleanup, after authenticated exact absence. */
export const purgeDeletedJob = async (state: RuntimeState, jobId: string): Promise<void> => {
  const execution = state.active.get(jobId);
  state.activeAbort.get(jobId)?.abort("WEBSITE_JOB_ABSENT");
  try {
    if (execution) await execution;
    await state.store.joinOutboxWrites();
    await state.browserAuthority.releaseJobBoundTarget(jobId, "website-admin-deletion", state.abort.signal);
    state.browserAuthority.purgeBrowserJob(jobId, "website-admin-deletion");
    await state.evidenceStore.deleteArtifactsForMission(jobId);
    await purgeProductionRuntimeTask(state.dataDir, jobId);
    await state.store.purgeJob(jobId);
    if (!state.draining) state.drainJobIds?.delete(jobId);
  } catch (cause) {
    throw executionFailure("failed", "PRODUCTION_JOB_PURGE_FAILED", { cause });
  }
};

export const reconcileBusinessAdmission = async (
  state: RuntimeState,
  record: StoredProductionTask,
  knownStatus?: RemoteProductionDeviceJobStatus,
  signal?: AbortSignal,
): Promise<"completed" | "pending" | "deleted"> => {
  const staged = record.staged_result;
  if (!staged) return record.status === "completed" ? "completed" : "pending";
  if (!record.current_attempt_id) {
    throw executionFailure("failed", "BUSINESS_ADMISSION_ATTEMPT_IDENTITY_MISSING");
  }
  if (!state.store.readResultReceivingReceipt(record.task.job_id, record.current_attempt_id, staged)) {
    let remote: Awaited<ReturnType<typeof readProductionDeviceJobStatus>>;
    try {
      remote = knownStatus ?? await readProductionDeviceJobStatus(state.session, record.task.job_id, signal);
    } catch (error) {
      if (!websiteJobAbsent(error)) throw error;
      state.activeAbort.get(record.task.job_id)?.abort("WEBSITE_JOB_ABSENT");
      return "deleted";
    }
    state.store.hydrateRemoteOutboxReceipts(record.task.job_id,
      remote.write_receipts.filter(receipt => receipt.write_kind === "terminal"));
    if (!state.store.readResultReceivingReceipt(record.task.job_id, record.current_attempt_id, staged)) {
      state.store.setCurrentReason(record.task.job_id, "RESULT_AUTHORITY_RECONCILIATION_PENDING");
      return "pending";
    }
    try {
      state.store.hydrateCurrentResultArtifacts(record.task.job_id,
        record.current_attempt_id, staged, remote.write_receipts);
    } catch (error) {
      state.lastErrorCode = failureCode(error, "PRODUCTION_RESULT_ARTIFACT_READBACK_INCOMPLETE");
      state.lastErrorReason = "Website receiving receipt is authoritative; local artifact receipt reconciliation remains pending.";
    }
  }
  state.store.completeTask(record.task.job_id, staged);
  return "completed";
};
