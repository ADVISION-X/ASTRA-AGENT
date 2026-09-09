import { executionFailure } from "../../execution-failure.js";
import {
  readProductionDeviceJobStatus,
  sendProductionOutboxWrite,
} from "./cloud-reconciliation-client.js";
import type { RuntimeState } from "./runtime-state.js";
import type { ClaimedProductionTask } from "./transport-protocol.js";

type RemoteStatus = Awaited<ReturnType<typeof readProductionDeviceJobStatus>>;

export const readClaimRecoveryStatus = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
): Promise<RemoteStatus> => {
  const remote = await readProductionDeviceJobStatus(state.session, job.job_id);
  if (remote.status !== "failed" || remote.terminal_status !== null
    || remote.accepted_attempt_count !== job.grant.accepted_attempt_count) {
    throw executionFailure("failed", "PRODUCTION_ATTEMPT_AUTHORITY_CONFLICT");
  }
  return remote;
};

export function throwStaleFenceReadbackFailure(deliveryError: unknown, statusError: unknown): never {
  if (deliveryError) {
    throw new AggregateError(
      [deliveryError, statusError],
      "PRODUCTION_STALE_FENCE_DELIVERY_AND_READBACK_FAILED",
      { cause: deliveryError },
    );
  }
  throw statusError;
}

export const reconcileStaleFenceCheckpoint = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  remote: RemoteStatus,
): Promise<RemoteStatus> => {
  const delivery = await state.store.deliverReauthorizedStaleCheckpoint({
    jobId: job.job_id,
    attemptId: job.grant.attempt_id,
    workerSessionId: job.grant.worker_session_id,
    workerSessionEpoch: job.grant.worker_session_epoch,
    leaseVersion: job.grant.lease_version,
    fenceHash: job.grant.execution_fence.fence_hash,
    receipts: remote.write_receipts,
  }, (write) => sendProductionOutboxWrite(state.session, write));
  const { requestId, deliveryError } = delivery;
  if (!requestId && !deliveryError) return remote;
  let refreshed: RemoteStatus;
  try {
    refreshed = await readClaimRecoveryStatus(state, job);
  } catch (statusError) {
    throwStaleFenceReadbackFailure(deliveryError, statusError);
  }
  state.store.hydrateRemoteOutboxReceipts(job.job_id, refreshed.write_receipts);
  if (!requestId && deliveryError) throw deliveryError;
  const matchingReceipts = refreshed.write_receipts.filter(
    (receipt) => receipt.request_id === requestId,
  );
  if (matchingReceipts.length !== 1
    || !requestId || state.store.readOutboxAuthority(requestId)?.state !== "delivered") {
    if (deliveryError) throw deliveryError;
    throw executionFailure("failed", "PRODUCTION_STALE_FENCE_REMOTE_RECEIPT_MISSING");
  }
  return refreshed;
};
