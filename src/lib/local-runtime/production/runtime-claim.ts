import { rm } from "node:fs/promises";
import path from "node:path";

import {
  executionFailure,
  failureCode,
  serializeTerminalFailure,
  typedExecutionFailure,
} from "../../typed-failure.js";
import {
  RuntimeFailureImpact,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  runtimeLogCauseEventId,
  type RuntimeSpanHandle,
} from "../../runtime-logs/index.js";
import {
  downloadProductionMaterials,
  terminalProductionTask,
  uploadProductionResult,
} from "./cloud-client.js";
import {
  readProductionDeviceJobStatus,
} from "./cloud-reconciliation-client.js";
import { productionCatalogHash, resolveProductionPlugin } from "./catalog.js";
import { hashCanonical, type ProductionHash, type WebsiteAgentTask } from "./contracts.js";
import type { ProductionExecutionLease } from "./executor.js";
import {
  heartbeatWhileRunning,
  ProductionRuntimeBoundaryError,
} from "./runtime-execution-heartbeat.js";
import type { StoredProductionTask } from "./store.js";
import { websiteAgentTaskFromClaim, type ClaimedProductionTask } from "./transport-protocol.js";
import {
  checkpointWithLog,
  releaseLeaseWithLog,
  runRuntimeSpan,
  runRuntimeSpanSync,
  terminalSpanFailure,
} from "./runtime-logging.js";
import {
  jobIdentity,
  leaseAuthority,
  leaseBudget,
  safeReason,
  type RuntimeState,
} from "./runtime-state.js";
import {
  preservePostCheckpointReceiverFault,
  preservePostSubmitReadbackFault,
} from "./runtime-claim-fault-preservation.js";

const isResultTransportBoundary = (error: unknown): boolean => {
  const typed = typedExecutionFailure(error);
  const code = typed?.code ?? "";
  return code === "CLOUD_TRANSPORT_UNAVAILABLE"
    || code === "PRODUCTION_OUTBOX_DELIVERY_BACKOFF_ACTIVE"
    || code === "AI_LEASE_FENCE_STALE" || code === "AI_V6_LEASE_RACE"
    || code === "AI_V6_JOB_NOT_FOUND"
    || code.startsWith("PRODUCTION_REMOTE_RECEIPT_")
    || code.startsWith("PRODUCTION_OUTBOX_")
    || (typed?.httpStatus !== null && typed?.httpStatus !== undefined && typed.httpStatus >= 500);
};


const releaseUnacceptedClaim = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  error: unknown,
  spanId: string,
  causeEventId: string,
): Promise<void> => {
  await releaseLeaseWithLog(state, job, spanId,
    {
      reasonCode: failureCode(error).startsWith("V6_DEADLINE_")
        ? "LEASE_SAFETY_BUDGET_EXHAUSTED" : "CAPABILITY_CHANGED_BEFORE_ACCEPT",
      receiverCheckpoint: null,
      confirmedSubmit: null,
    },
    causeEventId);
};

const persistAttemptFailure = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  failure: ReturnType<typeof serializeTerminalFailure>,
  parentSpanId: string,
  checkpointSeq: number,
): Promise<void> => {
  state.store.recordAttemptFailure(job.job_id, job.grant.attempt_id, failure);
  state.store.recordLease(leaseAuthority(job, "stale", null));
  try {
    await checkpointWithLog(
      state, job, parentSpanId, "attempt_failure", checkpointSeq, failure,
    );
  } catch (checkpointError) {
    state.lastErrorCode = failureCode(checkpointError, "CHECKPOINT_STORAGE_FAILED");
    state.lastErrorReason = safeReason(checkpointError);
  }
};

const readClaimRecoveryStatus = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
): Promise<Awaited<ReturnType<typeof readProductionDeviceJobStatus>>> => {
  const remote = await readProductionDeviceJobStatus(state.session, job.job_id);
  if (remote.status !== "failed" || remote.terminal_status !== null
    || remote.accepted_attempt_count !== job.grant.accepted_attempt_count) {
    throw executionFailure("failed", "PRODUCTION_ATTEMPT_AUTHORITY_CONFLICT");
  }
  return remote;
};

type ClaimCheckpointCursor = Readonly<{
  accepted: boolean;
  checkpointSeq: number;
  checkpointHash: ProductionHash | null;
  recoveredCheckpointPrefix: boolean;
}>;

const assertClaimIdentity = (job: ClaimedProductionTask, task: WebsiteAgentTask): void => {
  if (job.grant.capability_manifest_hash !== productionCatalogHash) {
    throw executionFailure("failed", "CAPABILITY_MANIFEST_CHANGED_BEFORE_ACCEPT");
  }
  const plugin = resolveProductionPlugin(task.product_id, task.action_id).plugin;
  if (job.grant.expected_catalog_hash !== productionCatalogHash
    || job.grant.expected_plugin_id !== plugin.pluginId
    || job.grant.expected_plugin_version !== plugin.pluginVersion) {
    throw executionFailure("failed", "CLAIMED_PLUGIN_IDENTITY_MISMATCH");
  }
};

const acceptClaim = (
  state: RuntimeState,
  job: ClaimedProductionTask,
  remote: Awaited<ReturnType<typeof readProductionDeviceJobStatus>>,
  continuingAttempt: boolean,
  abort: AbortController,
  jobSpan: RuntimeSpanHandle,
) => {
  const task = websiteAgentTaskFromClaim(job);
  assertClaimIdentity(job, task);
  const budget = leaseBudget(job, abort);
  const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: job.job_id, parentSpanId: jobSpan.spanId, owner: "production-runtime",
    component: "production-store", operation: "job.durable-accept", typedIdentity: jobIdentity(job),
  }));
  let record = runRuntimeSpanSync({
    span, action: () => state.executor.accept(task, job.grant.attempt_id), failureCode: "DURABLE_ACCEPT_FAILED",
    success: (accepted) => ({
      authorityRef: `production-task:${job.job_id}`, authorityHash: hashCanonical(accepted),
    }),
  });
  if (record.status !== "failed") {
    throw new Error("PRODUCTION_TASK_ALREADY_TERMINAL");
  }
  let cursor: ClaimCheckpointCursor = {
    accepted: continuingAttempt,
    checkpointSeq: 0,
    checkpointHash: null,
    recoveredCheckpointPrefix: false,
  };
  if (continuingAttempt && record.staged_result === null
    && (record.attempt_failure === null
      || record.attempt_failure.code === "AI_V6_CHECKPOINT_SEQUENCE_INVALID")) {
    const prefix = state.store.recoverCheckpointPrefix({
      jobId: job.job_id,
      attemptId: job.grant.attempt_id,
      acceptedAttemptCount: job.grant.accepted_attempt_count,
      receipts: remote.write_receipts,
    });
    record = state.store.readTask(job.job_id)!;
    cursor = {
      accepted: true,
      checkpointSeq: prefix.checkpointSeq,
      checkpointHash: prefix.checkpointHash,
      recoveredCheckpointPrefix: true,
    };
  }
  state.store.recordLease(leaseAuthority(job, "active", job.grant.lease_expires_at));
  return { task, budget, record, cursor };
};

const downloadClaimMaterials = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  cursor: ClaimCheckpointCursor,
  acceptance: { durable: "unknown" | "unaccepted" | "accepted" },
  materialDir: string,
  jobSpan: RuntimeSpanHandle,
) => {
  const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: job.job_id, parentSpanId: jobSpan.spanId, owner: "production-runtime",
    component: "production-materials", operation: "material.download-verify", typedIdentity: jobIdentity(job),
  }));
  return runRuntimeSpan({
    span, failureCode: "MATERIAL_DOWNLOAD_VERIFY_FAILED", action: async () => {
      let checkpointSeq = cursor.checkpointSeq;
      if (!cursor.accepted) {
        const accepted = await checkpointWithLog(state, job, span.spanId, "accepted", checkpointSeq + 1);
        checkpointSeq = accepted.checkpointSeq;
        cursor = { ...cursor, checkpointHash: accepted.checkpointHash };
        acceptance.durable = "accepted";
      }
      const materials = await downloadProductionMaterials(state.session, job, materialDir);
      if (checkpointSeq < 3) {
        const checkpoint = await checkpointWithLog(
          state, job, span.spanId, "progress", checkpointSeq + 1,
        );
        return { checkpoint: checkpoint.checkpointHash, checkpointSeq: checkpoint.checkpointSeq, materials };
      }
      if (!cursor.checkpointHash) {
        throw executionFailure("failed", "PRODUCTION_RECOVERY_CHECKPOINT_HASH_MISSING");
      }
      return { checkpoint: cursor.checkpointHash, checkpointSeq, materials };
    },
  });
};

const handleRuntimeBoundaryFailure = async (input: Readonly<{
  state: RuntimeState;
  job: ClaimedProductionTask;
  durability: "unknown" | "unaccepted" | "accepted";
  error: unknown;
  parentSpanId: string;
  causeEventId: string;
}>): Promise<void> => {
  const current = input.state.store.readTask(input.job.job_id);
  if (current?.status === "failed" && current.current_attempt_id === input.job.grant.attempt_id) {
    input.state.store.recordLease(leaseAuthority(input.job, "stale", null));
    input.state.store.setCurrentReason(
      input.job.job_id,
      `RUNTIME_RECOVERY_REQUIRED:${failureCode(input.error, "PRODUCTION_RUNTIME_BOUNDARY_FAILED")}`,
    );
  }
  if (input.durability !== "unaccepted") return;
  try {
    await releaseUnacceptedClaim(
      input.state, input.job, input.error, input.parentSpanId, input.causeEventId,
    );
  } catch (releaseError) {
    input.state.lastErrorCode = failureCode(releaseError, "LEASE_RELEASE_FAILED");
    input.state.lastErrorReason = safeReason(releaseError);
  }
};

const executeAndUpload = async (input: Readonly<{
  state: RuntimeState;
  job: ClaimedProductionTask;
  task: WebsiteAgentTask;
  budget: ProductionExecutionLease;
  checkpoint: ProductionHash;
  materials: Awaited<ReturnType<typeof downloadProductionMaterials>>;
  identity: StoredProductionTask["identity"];
  abort: AbortController;
  jobSpan: RuntimeSpanHandle;
}>) => {
  let uploaded: Awaited<ReturnType<typeof uploadProductionResult>> | undefined;
  let uploadBoundaryFailure: unknown | undefined;
  let execution: Awaited<ReturnType<RuntimeState["executor"]["execute"]>>;
  try {
    execution = await heartbeatWhileRunning({
      state: input.state, job: input.job, budget: input.budget, checkpointHash: input.checkpoint,
      execution: input.state.executor.execute(input.task, input.materials, input.budget, input.jobSpan.spanId,
        async (output, continuationRef) => {
        const span = requireRuntimeLogWrite(input.state.runtimeLogger.startSpan({
          traceId: input.job.job_id, parentSpanId: input.jobSpan.spanId, owner: "production-runtime",
          component: "production-result", operation: "result.upload", typedIdentity: jobIdentity(input.job),
        }));
        try {
          uploaded = await runRuntimeSpan({
            span, failureCode: "RESULT_UPLOAD_FAILED", action: () => uploadProductionResult({
              session: input.state.session, store: input.state.store, job: input.job,
              identity: input.identity, output, continuationRef, dataDir: input.state.dataDir,
            }),
          });
        } catch (error) {
          if (isResultTransportBoundary(error)) uploadBoundaryFailure = error;
          throw error;
        }
        return uploaded.envelope;
        }),
      abort: input.abort, parentSpanId: input.jobSpan.spanId,
    });
  } catch (error) {
    if (uploadBoundaryFailure !== undefined) {
      throw new ProductionRuntimeBoundaryError(uploadBoundaryFailure);
    }
    throw error;
  }
  if (!uploaded) throw new Error("PLUGIN_RESULT_UPLOAD_MISSING");
  return { execution, uploaded };
};

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
  await rm(path.join(state.dataDir, "plugin-tasks", "production-runtime", record.task.job_id, "materials"), {
    recursive: true, force: true,
  });
  return "completed";
};

const completeClaim = async (input: Readonly<{
  state: RuntimeState;
  job: ClaimedProductionTask;
  execution: Awaited<ReturnType<RuntimeState["executor"]["execute"]>>;
  uploaded: Awaited<ReturnType<typeof uploadProductionResult>>;
  materialDir: string;
  jobSpan: RuntimeSpanHandle;
}>): Promise<void> => {
  const span = requireRuntimeLogWrite(input.state.runtimeLogger.startSpan({
    traceId: input.job.job_id, parentSpanId: input.jobSpan.spanId, boundaryId: input.job.grant.claim_batch_id,
    owner: "production-runtime", component: "production-runtime", operation: "job.terminal",
    typedIdentity: jobIdentity(input.job),
  }));
  const payloadHash = hashCanonical(input.execution.result);
  input.state.store.stageResult(input.job.job_id, input.execution.result);
  await runRuntimeSpan({
    span, failureCode: "JOB_TERMINAL_FAILED", action: async () => {
      await terminalProductionTask(input.state.session, input.state.store, input.job, {
        status: "completed", payload_hash: payloadHash,
        result_receipt_hashes: input.uploaded.artifact_receipts.map((receipt) => receipt.receipt_hash),
      });
      input.state.store.setCurrentReason(input.job.job_id, "BUSINESS_ADMISSION_PENDING");
      return input.state.store.readTask(input.job.job_id)!;
    },
    success: (record) => ({
      authorityRef: `production-task:${input.job.job_id}`, authorityHash: hashCanonical(record),
    }),
  });
  input.state.store.recordLease(leaseAuthority(input.job, "absent", null));
  const record = input.state.store.readTask(input.job.job_id)!;
  const admission = await reconcileBusinessAdmission(input.state, record);
  const current = input.state.store.readTask(input.job.job_id)!;
  if (admission === "completed") {
    requireRuntimeLogWrite(input.jobSpan.terminal({
      outcome: "succeeded", authorityRef: `production-task:${input.job.job_id}`,
      authorityHash: hashCanonical(current),
    }));
    return;
  }
  requireRuntimeLogWrite(input.jobSpan.terminal({
    outcome: "failed", authorityRef: `production-task:${input.job.job_id}`,
    authorityHash: hashCanonical(current), failure: runtimeFailureFromError({
      error: new Error(current.current_reason ?? "BUSINESS_ADMISSION_PENDING"),
      code: current.current_reason?.split(":")[0] ?? "BUSINESS_ADMISSION_PENDING",
      responsibleOwner: "website",
      impact: RuntimeFailureImpact.BLOCKING,
    }),
  }));
};

const haltForClaimAuthority = async (input: Readonly<{
  state: RuntimeState;
  job: ClaimedProductionTask;
  remote: Awaited<ReturnType<typeof readProductionDeviceJobStatus>>;
  record: StoredProductionTask;
  cursor: ClaimCheckpointCursor;
  continuingAttempt: boolean;
  jobSpan: RuntimeSpanHandle;
}>): Promise<boolean> => {
  if (input.continuingAttempt && (input.record.staged_result || input.remote.write_receipts.some((receipt) =>
    receipt.write_kind === "artifact" || receipt.write_kind === "terminal"))) {
    input.state.store.hydrateRemoteOutboxReceipts(input.job.job_id, input.remote.write_receipts);
    input.state.store.recordLease(leaseAuthority(input.job, "stale", null));
    input.state.store.setCurrentReason(input.job.job_id, "RESULT_WRITE_RECONCILIATION_REQUIRED");
    terminalSpanFailure(
      input.jobSpan, executionFailure("failed", "RESULT_WRITE_RECONCILIATION_REQUIRED"), null,
      "RESULT_WRITE_RECONCILIATION_REQUIRED",
    );
    return true;
  }
  if (input.continuingAttempt && !input.cursor.recoveredCheckpointPrefix) {
    input.state.store.recordLease(leaseAuthority(input.job, "stale", null));
    const reason = input.record.attempt_failure
      ? "REMOTE_ATTEMPT_FAILURE_RECONCILIATION_REQUIRED"
      : "CONTINUING_ATTEMPT_RECONCILIATION_REQUIRED";
    input.state.store.setCurrentReason(input.job.job_id, reason);
    terminalSpanFailure(
      input.jobSpan, executionFailure("failed", reason), null, reason,
    );
    return true;
  }
  if (!input.record.attempt_failure) return false;
  throw executionFailure("failed", "PRODUCTION_ATTEMPT_AUTHORITY_CONFLICT");
};

export const executeClaim = async (state: RuntimeState, job: ClaimedProductionTask): Promise<void> => {
  const abort = state.activeAbort.get(job.job_id)!;
  const acceptance: { durable: "unknown" | "unaccepted" | "accepted" } = { durable: "unknown" };
  const materialDir = path.join(state.dataDir, "plugin-tasks", "production-runtime", job.job_id, "materials");
  const jobSpan = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: job.job_id, boundaryId: job.grant.claim_batch_id, owner: "production-runtime",
    component: "production-runtime", operation: "job.execute", typedIdentity: jobIdentity(job),
  }));
  try {
    const prior = state.store.readTask(job.job_id);
    const continuingAttempt = Boolean(prior?.status === "failed"
      && prior.current_attempt_id === job.grant.attempt_id);
    acceptance.durable = continuingAttempt ? "accepted" : "unaccepted";
    const remote = await readClaimRecoveryStatus(state, job);
    const claim = acceptClaim(state, job, remote, continuingAttempt, abort, jobSpan);
    if (await haltForClaimAuthority({
      state, job, remote, record: claim.record, cursor: claim.cursor, continuingAttempt, jobSpan,
    })) return;
    state.store.markExecuting(job.job_id);
    const material = await downloadClaimMaterials(
      state, job, claim.cursor, acceptance, materialDir, jobSpan,
    );
    let result: Awaited<ReturnType<typeof executeAndUpload>>;
    try {
      result = await executeAndUpload({
        state, job, task: claim.task, budget: claim.budget, checkpoint: material.checkpoint,
        materials: material.materials, identity: claim.record.identity, abort, jobSpan,
      });
    } catch (error) {
      if (error instanceof ProductionRuntimeBoundaryError) throw error.boundaryCause;
      const failureEvent = terminalSpanFailure(
        jobSpan, error, runtimeLogCauseEventId(error), "JOB_EXECUTION_FAILED",
      );
      if (await preservePostCheckpointReceiverFault(
        state, job, error, jobSpan.spanId, failureEvent.eventId,
      )) return;
      if (await preservePostSubmitReadbackFault(
        state, job, error, jobSpan.spanId, failureEvent.eventId,
      )) return;
      await persistAttemptFailure(
        state, job, serializeTerminalFailure(error), jobSpan.spanId, material.checkpointSeq + 1,
      );
      return;
    }
    await completeClaim({ state, job, ...result, materialDir, jobSpan });
  } catch (error) {
    const failureEvent = terminalSpanFailure(
      jobSpan, error, runtimeLogCauseEventId(error), "JOB_RUNTIME_BOUNDARY_FAILED",
    );
    await handleRuntimeBoundaryFailure({
      state, job, durability: acceptance.durable, error, parentSpanId: jobSpan.spanId,
      causeEventId: failureEvent.eventId,
    });
  }
};
