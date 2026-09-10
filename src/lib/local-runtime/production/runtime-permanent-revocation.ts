import { executionFailure, failureCode } from "../../execution-failure.js";
import { runtimeLogCauseEventId, type RuntimeSpanHandle } from "../../runtime-logs/index.js";
import {
  readProductionDeviceJobStatus,
  type RemoteProductionDeviceJobStatus,
} from "./cloud-reconciliation-client.js";
import { hashCanonical } from "./contracts.js";
import { releaseLeaseWithLog, terminalSpanFailure } from "./runtime-logging.js";
import { leaseAuthority, safeReason, wait, type RuntimeState } from "./runtime-state.js";
import { type ClaimedProductionTask } from "./transport-protocol.js";

export const permanentAuthorizationRevoked = (signal: AbortSignal): boolean => {
  const reason = typeof signal.reason === "string" ? signal.reason : "";
  return reason === "CONTROL_INTENT:cancel_requested:PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED";
};

export const remotePermanentAuthorizationRevoked = (
  remote: RemoteProductionDeviceJobStatus,
): boolean => remote.control_intent.intent === "cancel_requested"
  && remote.control_intent.reason_code === "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED"
  && remote.current_reason?.code === "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED";

export const settleInactivePermanentAuthorizationRevocation = (
  state: RuntimeState,
  jobId: string,
  remote: RemoteProductionDeviceJobStatus,
): boolean => {
  if (!remotePermanentAuthorizationRevoked(remote)) return false;
  const activeAbort = state.activeAbort.get(jobId);
  if (activeAbort) {
    activeAbort.abort("CONTROL_INTENT:cancel_requested:PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED");
    return true;
  }
  if (!state.store.readTask(jobId)) throw executionFailure("failed", "PRODUCTION_REVOCATION_TASK_AUTHORITY_INVALID");
  state.store.settlePermanentlyRevokedJob(jobId, "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED");
  return true;
};

const deletionLeaseDeadline = (job: ClaimedProductionTask): number => {
  const remaining = Date.parse(job.grant.lease_expires_at) - Date.parse(job.grant.server_now);
  return performance.now() + Math.max(0, Number.isFinite(remaining) ? remaining : 0);
};

const releaseReceiptObserved = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  stableRequestId: string,
): Promise<boolean> => {
  let remote: Awaited<ReturnType<typeof readProductionDeviceJobStatus>> | null = null;
  try {
    remote = await readProductionDeviceJobStatus(state.session, job.job_id);
  } catch (error) {
    state.lastErrorCode = failureCode(error, "LEASE_RELEASE_READBACK_FAILED");
    state.lastErrorReason = safeReason(error);
  }
  return remote?.write_receipts.some((receipt) => receipt.request_id === stableRequestId
    && receipt.write_kind === "lease_release") ?? false;
};

const releaseRevokedLease = async (input: Readonly<{
  state: RuntimeState;
  job: ClaimedProductionTask;
  jobSpan: RuntimeSpanHandle;
  failureEventId: string;
  error: unknown;
}>): Promise<void> => {
  const release = {
    reasonCode: "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED" as const,
    receiverCheckpoint: null,
    confirmedSubmit: null,
  };
  const stableRequestId = `aiprelease_${hashCanonical({
    job_id: input.job.job_id,
    attempt_id: input.job.grant.attempt_id,
    lease_version: input.job.grant.lease_version,
    reason_code: release.reasonCode,
  }).slice(7, 47)}`;
  const deadline = deletionLeaseDeadline(input.job);
  while (performance.now() < deadline && !input.state.abort.signal.aborted) {
    try {
      await releaseLeaseWithLog(input.state, input.job, input.jobSpan.spanId, release,
        input.failureEventId, stableRequestId);
      input.state.store.recordLease(leaseAuthority(input.job, "absent", null));
      return;
    } catch (error) {
      if (await releaseReceiptObserved(input.state, input.job, stableRequestId)) {
        input.state.store.recordLease(leaseAuthority(input.job, "absent", null));
        return;
      }
      input.state.store.recordLease(leaseAuthority(input.job, "stale", null));
      input.state.lastErrorCode = failureCode(error, "LEASE_RELEASE_FAILED");
      input.state.lastErrorReason = safeReason(error);
      await wait(Math.min(1_000, Math.max(0, deadline - performance.now())), input.state.abort.signal);
    }
  }
  input.state.store.setCurrentReason(input.job.job_id, "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED:LEASE_EXPIRED");
};

export const settlePermanentAuthorizationRevocation = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  error: unknown,
  jobSpan: RuntimeSpanHandle,
): Promise<void> => {
  const failureEvent = terminalSpanFailure(jobSpan,
    executionFailure("failed", "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED", { cause: error }),
    runtimeLogCauseEventId(error), "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED");
  state.store.settlePermanentlyRevokedJob(job.job_id, "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED");
  await releaseRevokedLease({ state, job, jobSpan, error, failureEventId: failureEvent.eventId });
};
