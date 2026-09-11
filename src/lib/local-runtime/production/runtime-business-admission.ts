import { executionFailure } from "../../execution-failure.js";
import { hashCanonical } from "./contracts.js";
import { readProductionDeviceJobStatus } from "./cloud-reconciliation-client.js";
import type { RuntimeState } from "./runtime-state.js";
import type { StoredProductionTask } from "./store.js";

export const reconcileBusinessAdmission = async (
  state: RuntimeState,
  record: StoredProductionTask,
): Promise<"completed" | "pending"> => {
  const staged = record.staged_result;
  if (!staged) return record.status === "completed" ? "completed" : "pending";
  const remote = await readProductionDeviceJobStatus(state.session, record.task.job_id);
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
