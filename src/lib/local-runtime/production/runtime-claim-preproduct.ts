import { executionFailure, failureCode } from "../../execution-failure.js";
import { requireRuntimeLogWrite, type RuntimeSpanHandle } from "../../runtime-logs/index.js";
import { readProductionDeviceJobStatus, type RemoteProductionDeviceJobStatus } from "./cloud-reconciliation-client.js";
import { buildTerminalProductionIntent, deliverTerminalProductionIntent } from "./cloud-terminal-intent.js";
import { buildProductionLeaseRelease, uploadProductionResult } from "./cloud-client.js";
import { hashCanonical, type WebsiteAgentResult } from "./contracts.js";
import { reconcileBusinessAdmission, websiteJobAbsent } from "./runtime-business-admission.js";
import { typedRuntimeTransportFailure } from "./transport-failure.js";
import { releaseLeaseWithLog, terminalSpanFailure } from "./runtime-logging.js";
import type { ProductionExecutionLease, WebsiteAgentTask } from "./contracts.js";
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
    state.activeAbort.get(job.job_id)?.abort("WEBSITE_JOB_ABSENT");
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

/** This is the original parent's receipt, never a new Website or Provider action. */
export async function reconcileContinuationParent(state: RuntimeState, task: WebsiteAgentTask, signal: AbortSignal): Promise<boolean> {
  if (!task.parent_task_ref) return true;
  const parent = state.store.readTask(task.parent_task_ref);
  const result = parent?.result ?? parent?.staged_result;
  if (!parent || !result || parent.task.product_id !== task.product_id || parent.task.action_id !== task.action_id
    || parent.task.business_identity.owner_ref !== task.business_identity.owner_ref
    || parent.task.business_identity.subject_ref !== task.business_identity.subject_ref
    || parent.task.parameters.input_version !== task.parameters.input_version
    || result.job_id !== task.parent_task_ref || result.result_payload_ref !== task.parent_result_ref
    || result.result_payload_hash !== task.parent_result_hash) {
    throw executionFailure("failed", "PRODUCTION_PARENT_RESULT_BINDING_INVALID");
  }
  if (parent.status === "completed") return true;
  try {
    const status = await reconcileBusinessAdmission(state, parent, undefined, signal);
    if (status === "deleted") throw executionFailure("failed", "PRODUCTION_PARENT_RESULT_BINDING_INVALID");
    return status === "completed";
  } catch (error) {
    const status = typedRuntimeTransportFailure(error)?.httpStatus;
    if ((status !== undefined && status >= 500) || failureCode(error) === "CLOUD_TRANSPORT_UNAVAILABLE") return false;
    throw error;
  }
}

/** An unavailable parent receipt may yield only this revision's zero-input lease. */
export async function prepareContinuationParent(state: RuntimeState, job: ClaimedProductionTask,
  task: WebsiteAgentTask, budget: ProductionExecutionLease, jobSpan: RuntimeSpanHandle): Promise<boolean> {
  if (!task.parent_task_ref) return true;
  const remaining = () => budget.expires_at_monotonic - performance.now();
  const signal = AbortSignal.any([budget.abort_signal, AbortSignal.timeout(Math.max(1, Math.floor(remaining())))]);
  if (await reconcileContinuationParent(state, task, signal)) return true;
  const error = executionFailure("failed", "PRODUCTION_CONTINUATION_RECEIPT_PENDING");
  const current = state.store.readTask(job.job_id);
  const history = state.browserAuthority.readJobBrowserHistoryEvidence(job.job_id);
  if (signal.aborted || remaining() <= 0 || !current || current.staged_result
    || state.store.readCompleteOutput(job.job_id, job.grant.attempt_id)
    || !history.walHistoryVerified || history.unresolvedCommandCount !== 0
    || state.browserAuthority.readJobPhysicalInputState(job.job_id) !== "zero"
    || state.browserAuthority.readAttemptPhysicalInputState(job.job_id, job.grant.attempt_id) !== "zero") throw error;
  const failure = terminalSpanFailure(jobSpan, error, null, "PRODUCTION_CONTINUATION_RECEIPT_PENDING");
  const release = buildProductionLeaseRelease(state.session, job, {
    reasonCode: "PROVIDER_READBACK_UNAVAILABLE", attemptFailure: null,
  });
  try { await releaseLeaseWithLog(state, job, jobSpan.spanId, release, failure.eventId); }
  catch (releaseError) {
    state.store.setCurrentReason(job.job_id, failureCode(releaseError, "PRODUCTION_CONTINUATION_RECEIPT_PENDING"));
  }
  return false;
}

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
  state: RuntimeState, job: ClaimedProductionTask, result: WebsiteAgentResult,
  artifactReceipts: RemoteProductionDeviceJobStatus["staged_artifact_receipts"],
): void => {
  const receipts = artifactReceipts.map((artifact) => artifact.receipt_hash);
  const recoveredIntent = buildTerminalProductionIntent(state.session, job, {
    status: "completed", payload_hash: hashCanonical(result), result_receipt_hashes: receipts,
    terminal_source_first_fact_raw: state.store.readAttemptFailureRaw(job.job_id),
  });
  state.store.markExecuting(job.job_id);
  state.store.stageResultAndEnqueueTerminal({
    jobId: job.job_id, attemptId: job.grant.attempt_id,
    result, terminal: recoveredIntent.write,
    websiteStagedArtifactReceipts: artifactReceipts,
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
    if (recovered) stageRecoveredResult(state, job, recovered, remote.staged_artifact_receipts);
  }
  if (!staged?.staged_result && remote.staged_result) {
    if (staged?.current_attempt_id !== job.grant.attempt_id
      || !job.grant.same_accepted_attempt) {
      throw executionFailure("failed", "PRODUCTION_WEBSITE_STAGED_RESULT_IDENTITY_MISMATCH");
    }
    stageRecoveredResult(state, job, remote.staged_result, remote.staged_artifact_receipts);
  }
};

/** A durable result always takes the delivery path before Product execution. */
export const deliverExistingResult = async (
  state: RuntimeState, job: ClaimedProductionTask, acceptance: Acceptance,
  jobSpan: RuntimeSpanHandle,
): Promise<boolean> => {
  let durableStaged = state.store.readTask(job.job_id);
  const complete = state.store.readCompleteOutput(job.job_id, job.grant.attempt_id);
  if (!durableStaged?.staged_result && !complete) return false;
  if (durableStaged?.current_attempt_id !== job.grant.attempt_id
    || !job.grant.same_accepted_attempt) {
    throw executionFailure("failed", "PRODUCTION_STAGED_RESULT_REGRANT_IDENTITY_MISMATCH");
  }
  acceptance.durable = "accepted";
  if (!durableStaged.staged_result && complete) {
    const uploaded = await uploadProductionResult({ session: state.session, store: state.store, job, complete });
    stageRecoveredResult(state, job, uploaded.envelope, uploaded.artifact_receipts);
    durableStaged = state.store.readTask(job.job_id)!;
  }
  const result = durableStaged.staged_result!;
  const intent = buildTerminalProductionIntent(state.session, job, {
    status: "completed", payload_hash: hashCanonical(result),
    result_receipt_hashes: state.store.readStagedTerminalReceipts(
      job.job_id, job.grant.attempt_id, result),
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
