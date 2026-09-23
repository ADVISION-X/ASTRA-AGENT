import { executionFailure, executionFailureMetadata, failureCode } from "../../execution-failure.js";
import type { BuiltProductionLeaseRelease } from "./cloud-client.js";
import {
  readProductionDeviceJobStatus,
  type RemoteProductionDeviceJobStatus,
} from "./cloud-reconciliation-client.js";
import { hashCanonical } from "./contracts.js";
import { releaseLeaseWithLog } from "./runtime-logging.js";
import type { RuntimeState } from "./runtime-state.js";
import { classifyAttemptFailure, type AttemptFailureFirstFact, type SerializedTerminalFailure } from "./terminal-failure.js";
import type { ClaimedProductionTask } from "./transport-protocol.js";

export const firstFact = (
  failureCore: SerializedTerminalFailure,
  release: BuiltProductionLeaseRelease,
): AttemptFailureFirstFact => Object.freeze({
  failure_core: failureCore,
  release_descriptor: release.descriptor,
});

const remoteFailureCore = (
  remote: NonNullable<RemoteProductionDeviceJobStatus["attempt_failure"]>,
): SerializedTerminalFailure => Object.freeze({
  code: remote.code,
  mutation_outcome: remote.mutation_outcome,
  effect_scope: remote.effect_scope,
  child_capability_id: remote.child_capability_id,
  browser_outcome: remote.browser_outcome,
  evidence_ref: remote.evidence_ref,
  evidence_hash: remote.evidence_hash,
  child_proof_ref: remote.child_proof_ref,
  child_proof_hash: remote.child_proof_hash,
  stopped_empty_proof: remote.stopped_empty_proof,
  cause: remote.cause,
  provider_effect_identity_hash: remote.provider_effect_identity_hash,
  settled_result_payload_hash: remote.settled_result_payload_hash,
});

export const releaseReceiptMatches = (
  remote: RemoteProductionDeviceJobStatus,
  failure: AttemptFailureFirstFact,
): boolean => {
  const candidates = remote.write_receipts.filter((receipt) =>
    receipt.request_id === failure.release_descriptor.request_id
    && receipt.write_kind === "lease_release");
  if (candidates.length === 0) return false;
  if (candidates.length !== 1) {
    throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_RECEIPT_CONFLICT");
  }
  const receipt = candidates[0]!;
  if (receipt.payload_hash !== failure.release_descriptor.write_request_payload_hash) return false;
  const response = receipt.response_json;
  const disposition = classifyAttemptFailure(failure.failure_core);
  const expectedReason = failure.failure_core.code === "RESULT_SETTLED_UNUSABLE"
    || failure.failure_core.code === "GPT_RESPONSE_STOPPED_EMPTY"
    ? "RESULT_REVISION_REJECTED"
    : disposition === "same_attempt_provider_readback"
      ? "PROVIDER_EFFECT_READBACK_PENDING"
      : failure.failure_core.code;
  return JSON.stringify(Object.keys(response).sort()) === JSON.stringify([
    "attempt_failure", "job_id", "lease_disposition", "payload_hash", "reason_code",
    "schema_version", "task_status", "terminal_payload_hash",
  ])
    && response.schema_version === "xuanxue-ai-lease-release-receipt.v6"
    && response.job_id === remote.job_id
    && response.task_status === "failed"
    && response.lease_disposition === "released"
    && response.reason_code === expectedReason
    && response.payload_hash === failure.release_descriptor.body_payload_hash
    && response.terminal_payload_hash === null
    && hashCanonical(response.attempt_failure) === hashCanonical(failure.failure_core);
};

export const remoteFailureMatches = (
  remote: RemoteProductionDeviceJobStatus,
  failure: AttemptFailureFirstFact,
): boolean => Boolean(remote.attempt_failure
  && remote.attempt_failure.from_status === "failed"
  && remote.attempt_failure.to_status === "failed"
  && remote.attempt_failure.attempt_id === failure.release_descriptor.attempt_id
  && remote.attempt_failure.lease_version === failure.release_descriptor.lease_version
  && hashCanonical(remoteFailureCore(remote.attempt_failure)) === hashCanonical(failure.failure_core));

export const attemptFailureAuthorityConflict = (
  remote: RemoteProductionDeviceJobStatus,
  failure: AttemptFailureFirstFact,
) => {
  const remoteHash = hashCanonical(remoteFailureCore(remote.attempt_failure!));
  const localHash = hashCanonical(failure.failure_core);
  const evidenceRef = ["attempt-failure-authority-conflict", remote.job_id,
    failure.release_descriptor.attempt_id, String(failure.release_descriptor.lease_version),
    remote.attempt_failure!.attempt_id, String(remote.attempt_failure!.lease_version),
    failure.release_descriptor.request_id, localHash, remoteHash].join("|");
  return executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_AUTHORITY_CONFLICT", {
    metadata: { mutationOutcome: "no", evidence: {
      evidenceRef,
      evidenceHash: hashCanonical({ evidenceRef }),
    } },
  });
};

const assertAttemptFailureReadback = (
  remote: RemoteProductionDeviceJobStatus,
  failure: AttemptFailureFirstFact,
  releaseOutcome: "response_received" | "response_unknown" | "conflict_409",
): void => {
  if (remote.attempt_failure && !remoteFailureMatches(remote, failure)) {
    throw attemptFailureAuthorityConflict(remote, failure);
  }
  if (releaseOutcome === "conflict_409") {
    if (!remoteFailureMatches(remote, failure)) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_READBACK_MISMATCH");
    }
    throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_CONFLICT_RESPONSE_INVALID");
  }
  if (!releaseReceiptMatches(remote, failure)) {
    throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_READBACK_MISMATCH");
  }
};

export const postFailureAndReadback = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  release: BuiltProductionLeaseRelease,
  failure: AttemptFailureFirstFact,
  parentSpanId: string,
  causeEventId: string,
): Promise<RemoteProductionDeviceJobStatus> => {
  let releaseError: unknown = null;
  try {
    await releaseLeaseWithLog(state, job, parentSpanId, release, causeEventId);
  } catch (error) {
    releaseError = error;
  }
  try {
    const remote = await readProductionDeviceJobStatus(state.session, job.job_id);
    const releaseOutcome = releaseError === null ? "response_received"
      : failureCode(releaseError) === "AI_PRODUCTION_ATTEMPT_FAILURE_IDEMPOTENCY_CONFLICT"
        ? "conflict_409" : "response_unknown";
    assertAttemptFailureReadback(remote, failure, releaseOutcome);
    return remote;
  } catch (readbackError) {
    if (releaseError) {
      const metadata = executionFailureMetadata(readbackError);
      throw executionFailure(
        "failed",
        failureCode(readbackError, "PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_FAILED"),
        { cause: new AggregateError(
          [releaseError, readbackError], "PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_FAILED",
        ), ...(metadata ? { metadata } : {}) },
      );
    }
    throw readbackError;
  }
};
