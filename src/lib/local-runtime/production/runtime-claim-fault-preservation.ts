import {
  failureCode,
  postCheckpointReceiverReceipt,
  postSubmitReadbackReceipt,
} from "../../typed-failure.js";
import { releaseLeaseWithLog } from "./runtime-logging.js";
import { leaseAuthority, safeReason, type RuntimeState } from "./runtime-state.js";
import type { ClaimedProductionTask } from "./transport-protocol.js";

export const preservePostCheckpointReceiverFault = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  error: unknown,
  parentSpanId: string,
  causeEventId: string,
): Promise<boolean> => {
  const receipt = postCheckpointReceiverReceipt(error);
  if (!receipt) return false;
  state.store.setCurrentReason(job.job_id, failureCode(error));
  state.store.recordLease(leaseAuthority(job, "stale", null));
  try {
    await releaseLeaseWithLog(state, job, parentSpanId, {
      reasonCode: "POST_CHECKPOINT_RECEIVER_FAULT",
      receiverCheckpoint: {
        artifact_ref: receipt.artifactRef,
        raw_dom_hash: receipt.rawDomHash,
        semantic_text_hash: receipt.semanticTextHash,
      },
      confirmedSubmit: null,
    }, causeEventId);
  } catch (releaseError) {
    state.lastErrorCode = failureCode(releaseError, "LEASE_RELEASE_FAILED");
    state.lastErrorReason = safeReason(releaseError);
  }
  return true;
};

export const preservePostSubmitReadbackFault = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  error: unknown,
  parentSpanId: string,
  causeEventId: string,
): Promise<boolean> => {
  const receipt = postSubmitReadbackReceipt(error);
  if (!receipt) return false;
  state.store.setCurrentReason(job.job_id, failureCode(error));
  state.store.recordLease(leaseAuthority(job, "stale", null));
  try {
    await releaseLeaseWithLog(state, job, parentSpanId, {
      reasonCode: "POST_SUBMIT_READBACK_FAULT",
      receiverCheckpoint: null,
      confirmedSubmit: {
        cause_code: receipt.causeCode,
        exact_call_identity_hash: receipt.exactCallIdentityHash,
        outcome: "CONFIRMED",
        terminal_at: receipt.terminalAt,
        evidence_ref: receipt.evidenceRef,
        evidence_hash: receipt.evidenceHash,
      },
    }, causeEventId);
  } catch (releaseError) {
    state.lastErrorCode = failureCode(releaseError, "LEASE_RELEASE_FAILED");
    state.lastErrorReason = safeReason(releaseError);
  }
  return true;
};
