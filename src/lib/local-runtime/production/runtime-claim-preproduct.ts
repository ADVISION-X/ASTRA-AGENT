import { executionFailure } from "../../execution-failure.js";
import { requireRuntimeLogWrite, type RuntimeSpanHandle } from "../../runtime-logs/index.js";
import { readProductionDeviceJobStatus, type RemoteProductionDeviceJobStatus } from "./cloud-reconciliation-client.js";
import { buildTerminalProductionIntent, deliverTerminalProductionIntent } from "./cloud-terminal-intent.js";
import { hashCanonical, type WebsiteAgentResult } from "./contracts.js";
import { purgeDeletedJob, reconcileBusinessAdmission, websiteJobAbsent } from "./runtime-business-admission.js";
import type { RuntimeState } from "./runtime-state.js";
import { websiteAgentTaskFromClaim, type ClaimedProductionTask } from "./transport-protocol.js";

type Acceptance = { durable: "unknown" | "unaccepted" | "accepted" };

/** Read the Website attempt authority before touching a local Product action. */
export const readClaimAuthority = async (
  state: RuntimeState, job: ClaimedProductionTask, jobSpan: RuntimeSpanHandle,
): Promise<RemoteProductionDeviceJobStatus | null> => {
  let remote: RemoteProductionDeviceJobStatus;
  try { remote = await readProductionDeviceJobStatus(state.session, job.job_id); }
  catch (error) {
    if (!websiteJobAbsent(error)) throw error;
    await purgeDeletedJob(state, job.job_id);
    requireRuntimeLogWrite(jobSpan.terminal({ outcome: "succeeded" }));
    return null;
  }
  if (remote.status !== "failed" || remote.terminal_status !== null
    || remote.accepted_attempt_count !== job.grant.accepted_attempt_count) {
    throw executionFailure("failed", "PRODUCTION_ATTEMPT_AUTHORITY_CONFLICT");
  }
  if (job.grant.same_accepted_attempt) {
    state.store.hydrateRemoteOutboxReceipts(job.job_id,
      remote.write_receipts.filter((receipt) => receipt.write_kind === "artifact"));
  }
  return remote;
};

/** Preserve local WAL/Outbox authority when the Runtime task row is missing. */
export const recoverMissingLocalTask = (
  state: RuntimeState, job: ClaimedProductionTask, remote: RemoteProductionDeviceJobStatus,
  acceptance: Acceptance, jobSpan: RuntimeSpanHandle,
): boolean => {
  if (state.store.readTask(job.job_id) || !job.grant.same_accepted_attempt
    || job.grant.source_handoff_seal_hash !== null
    || remote.attempt_failure !== null) return false;
  const outbox = state.store.readResultOutboxHistoryEvidence(job.job_id, job.grant.attempt_id);
  const browser = job.grant.delivery_only && remote.staged_result !== null
    ? null : state.browserAuthority.readJobBrowserHistoryEvidence(job.job_id);
  if (browser && !browser.walHistoryVerified) {
    throw executionFailure("failed", "PRODUCTION_LOCAL_AUTHORITY_HISTORY_UNVERIFIED");
  }
  if (outbox.rowCount === 0 && (browser?.rowCount ?? 0) === 0
    && remote.staged_result === null && remote.staged_artifact_receipts.length === 0) return false;
  state.executor.accept(websiteAgentTaskFromClaim(job), job.grant.attempt_id);
  acceptance.durable = "accepted";
  state.store.setCurrentReason(job.job_id, "LOCAL_AUTHORITY_RECOVERY_PENDING");
  requireRuntimeLogWrite(jobSpan.terminal({ outcome: "succeeded" }));
  return true;
};

const stageRecoveredResult = (
  state: RuntimeState, job: ClaimedProductionTask, remote: RemoteProductionDeviceJobStatus,
  result: WebsiteAgentResult,
): void => {
  const receipts = remote.staged_artifact_receipts.map((artifact) => artifact.receipt_hash);
  const recoveredIntent = buildTerminalProductionIntent(state.session, job, {
    status: "completed", payload_hash: hashCanonical(result), result_receipt_hashes: receipts,
    terminal_source_first_fact_raw: state.store.readAttemptFailureRaw(job.job_id),
  });
  state.store.markExecuting(job.job_id);
  state.store.stageResultAndEnqueueTerminal({
    jobId: job.job_id, attemptId: job.grant.attempt_id,
    result, terminal: recoveredIntent.write,
    websiteStagedArtifactReceipts: remote.staged_artifact_receipts,
  });
};

/** Recover an already uploaded envelope or the Website's staged result. */
export const restoreStagedResult = (
  state: RuntimeState, job: ClaimedProductionTask, remote: RemoteProductionDeviceJobStatus,
): void => {
  const staged = state.store.readTask(job.job_id);
  if (!staged?.staged_result && remote.staged_result === null
    && remote.staged_artifact_receipts.some((receipt) => receipt.role === "result_envelope")) {
    const recovered = state.store.readUploadedResultEnvelope(job.job_id, job.grant.attempt_id);
    if (recovered) stageRecoveredResult(state, job, remote, recovered);
  }
  if (!staged?.staged_result && remote.staged_result) {
    if (staged?.current_attempt_id !== job.grant.attempt_id
      || !job.grant.same_accepted_attempt) {
      throw executionFailure("failed", "PRODUCTION_WEBSITE_STAGED_RESULT_IDENTITY_MISMATCH");
    }
    stageRecoveredResult(state, job, remote, remote.staged_result);
  }
};

/** A durable result always takes the delivery path before Product execution. */
export const deliverExistingResult = async (
  state: RuntimeState, job: ClaimedProductionTask, acceptance: Acceptance,
  jobSpan: RuntimeSpanHandle,
): Promise<boolean> => {
  const durableStaged = state.store.readTask(job.job_id);
  if (!durableStaged?.staged_result) return false;
  if (durableStaged.current_attempt_id !== job.grant.attempt_id
    || !job.grant.same_accepted_attempt) {
    throw executionFailure("failed", "PRODUCTION_STAGED_RESULT_REGRANT_IDENTITY_MISMATCH");
  }
  const intent = buildTerminalProductionIntent(state.session, job, {
    status: "completed", payload_hash: hashCanonical(durableStaged.staged_result),
    result_receipt_hashes: state.store.readStagedTerminalReceipts(
      job.job_id, job.grant.attempt_id, durableStaged.staged_result),
    terminal_source_first_fact_raw: state.store.readAttemptFailureRaw(job.job_id),
  });
  state.store.enqueue(intent.write);
  acceptance.durable = "accepted";
  await deliverTerminalProductionIntent(state.session, state.store, intent);
  state.store.setCurrentReason(job.job_id, "BUSINESS_ADMISSION_PENDING");
  await reconcileBusinessAdmission(state, state.store.readTask(job.job_id)!);
  requireRuntimeLogWrite(jobSpan.terminal({ outcome: "succeeded" }));
  return true;
};
