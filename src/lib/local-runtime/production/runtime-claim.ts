import { rm } from "node:fs/promises";
import path from "node:path";

import {
  executionFailure,
  failureCode,
  serializeTerminalFailure,
} from "../../typed-failure.js";
import {
  RuntimeFailureImpact,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  runtimeLogCauseEventId,
  withRuntimeLogCause,
  type RuntimeSpanHandle,
} from "../../runtime-logs/index.js";
import {
  downloadProductionMaterials,
  renewProductionLease,
  terminalProductionTask,
  uploadProductionResult,
} from "./cloud-client.js";
import { readProductionDeviceJobStatus } from "./cloud-reconciliation-client.js";
import { productionCatalogHash, resolveProductionPlugin } from "./catalog.js";
import { hashCanonical, type ProductionHash, type WebsiteAgentTask } from "./contracts.js";
import type { ProductionExecutionLease } from "./executor.js";
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
  checkpointAuthority,
  jobIdentity,
  leaseAuthority,
  leaseBudget,
  safeReason,
  wait,
  type RuntimeState,
} from "./runtime-state.js";

const heartbeatWhileRunning = async <T>(
  state: RuntimeState,
  job: ClaimedProductionTask,
  budget: ProductionExecutionLease,
  checkpointHash: ProductionHash,
  execution: Promise<T>,
  abort: AbortController,
  parentSpanId: string,
): Promise<T> => {
  let settled = false;
  const tracked = execution.finally(() => { settled = true; });
  while (!settled && !abort.signal.aborted) {
    await Promise.race([tracked, wait(20_000, abort.signal)]);
    if (settled || abort.signal.aborted) break;
    const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
      traceId: job.job_id, parentSpanId, owner: "production-runtime", component: "production-lease",
      operation: "job.lease-renew", typedIdentity: jobIdentity(job),
    }));
    let receipt;
    try {
      receipt = await renewProductionLease(state.session, job, checkpointHash);
      const authority = state.store.recordLease(leaseAuthority(job, "active", receipt.lease_expires_at));
      requireRuntimeLogWrite(span.terminal({
        outcome: "succeeded", authorityRef: `production-lease:${job.job_id}`,
        authorityHash: hashCanonical(authority),
      }));
    } catch (error) {
      const authority = state.store.recordLease(leaseAuthority(job, "stale", null));
      const terminal = terminalSpanFailure(span, error, runtimeLogCauseEventId(error),
        "LEASE_RENEW_FAILED", {
          authorityRef: `production-lease:${job.job_id}`, authorityHash: hashCanonical(authority),
        });
      throw withRuntimeLogCause(error, terminal.eventId);
    }
    const relative = Date.parse(receipt.lease_expires_at) - Date.parse(receipt.server_now);
    if (!Number.isFinite(relative) || relative < 30_000) {
      throw executionFailure("failed", "V6_RENEW_BUDGET_INVALID");
    }
    budget.expires_at_monotonic = performance.now() + relative - 10_000;
    budget.command_ttl_ms = Math.min(20_000, relative - 10_000);
    if (receipt.control_intent.intent !== "none") {
      abort.abort(`CONTROL_INTENT:${receipt.control_intent.intent}:${receipt.control_intent.reason_code ?? "none"}`);
    }
  }
  return tracked;
};

const releaseUnacceptedClaim = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  error: unknown,
  spanId: string,
  causeEventId: string,
): Promise<void> => {
  await releaseLeaseWithLog(state, job, spanId,
    failureCode(error).startsWith("V6_DEADLINE_") ? "LEASE_SAFETY_BUDGET_EXHAUSTED" : "CAPABILITY_CHANGED_BEFORE_ACCEPT",
    causeEventId);
};

const persistAttemptFailure = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  error: unknown,
  parentSpanId: string,
): Promise<void> => {
  const failure = serializeTerminalFailure(error);
  state.store.recordAttemptFailure(job.job_id, job.grant.attempt_id, failure);
  state.store.recordLease(leaseAuthority(job, "stale", null));
  try {
    await checkpointWithLog(
      state, job, parentSpanId, "attempt_failure", failure,
    );
  } catch (checkpointError) {
    state.lastErrorCode = failureCode(checkpointError, "CHECKPOINT_STORAGE_FAILED");
    state.lastErrorReason = safeReason(checkpointError);
  }
};

const handleClaimFailure = async (input: Readonly<{
  state: RuntimeState;
  job: ClaimedProductionTask;
  accepted: boolean;
  error: unknown;
  parentSpanId: string;
  causeEventId: string;
}>): Promise<void> => {
  const durable = input.accepted || input.state.store.readTask(input.job.job_id) !== null;
  if (!durable) return releaseUnacceptedClaim(
    input.state, input.job, input.error, input.parentSpanId, input.causeEventId,
  );
  return persistAttemptFailure(
    input.state, input.job, input.error, input.parentSpanId,
  );
};

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
  const record = runRuntimeSpanSync({
    span, action: () => state.executor.accept(task, job.grant.attempt_id), failureCode: "DURABLE_ACCEPT_FAILED",
    success: (accepted) => ({
      authorityRef: `production-task:${job.job_id}`, authorityHash: hashCanonical(accepted),
    }),
  });
  if (record.status !== "failed") {
    throw new Error("PRODUCTION_TASK_ALREADY_TERMINAL");
  }
  state.store.recordLease(leaseAuthority(job, "active", job.grant.lease_expires_at));
  state.store.recordCheckpoint(checkpointAuthority(job, "none", null, null));
  state.store.markExecuting(job.job_id);
  return { task, budget, record };
};

const downloadClaimMaterials = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  materialDir: string,
  jobSpan: RuntimeSpanHandle,
) => {
  const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: job.job_id, parentSpanId: jobSpan.spanId, owner: "production-runtime",
    component: "production-materials", operation: "material.download-verify", typedIdentity: jobIdentity(job),
  }));
  return runRuntimeSpan({
    span, failureCode: "MATERIAL_DOWNLOAD_VERIFY_FAILED", action: async () => {
      const checkpoint = await checkpointWithLog(state, job, span.spanId, "accepted");
      const materials = await downloadProductionMaterials(state.session, job, materialDir);
      await checkpointWithLog(state, job, span.spanId, "progress");
      return { checkpoint, materials };
    },
  });
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
  const execution = await heartbeatWhileRunning(
    input.state, input.job, input.budget, input.checkpoint,
    input.state.executor.execute(input.task, input.materials, input.budget, input.jobSpan.spanId,
      async (output, continuationRef) => {
        const span = requireRuntimeLogWrite(input.state.runtimeLogger.startSpan({
          traceId: input.job.job_id, parentSpanId: input.jobSpan.spanId, owner: "production-runtime",
          component: "production-result", operation: "result.upload", typedIdentity: jobIdentity(input.job),
        }));
        uploaded = await runRuntimeSpan({
          span, failureCode: "RESULT_UPLOAD_FAILED", action: () => uploadProductionResult({
            session: input.state.session, store: input.state.store, job: input.job,
            identity: input.identity, output, continuationRef, dataDir: input.state.dataDir,
          }),
        });
        return uploaded.envelope;
      }),
    input.abort, input.jobSpan.spanId,
  );
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

export const executeClaim = async (state: RuntimeState, job: ClaimedProductionTask): Promise<void> => {
  const abort = state.activeAbort.get(job.job_id)!;
  let accepted = false;
  const materialDir = path.join(state.dataDir, "plugin-tasks", "production-runtime", job.job_id, "materials");
  const jobSpan = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: job.job_id, boundaryId: job.grant.claim_batch_id, owner: "production-runtime",
    component: "production-runtime", operation: "job.execute", typedIdentity: jobIdentity(job),
  }));
  try {
    const claim = acceptClaim(state, job, abort, jobSpan);
    accepted = true;
    const material = await downloadClaimMaterials(state, job, materialDir, jobSpan);
    const result = await executeAndUpload({
      state, job, task: claim.task, budget: claim.budget, checkpoint: material.checkpoint,
      materials: material.materials, identity: claim.record.identity, abort, jobSpan,
    });
    await completeClaim({ state, job, ...result, materialDir, jobSpan });
  } catch (error) {
    const normalized = abort.signal.aborted && String(abort.signal.reason ?? "").includes("cancel_requested")
      ? executionFailure("failed", "USER_CANCELLED", { mutationOutcome: "no", cause: error }) : error;
    const failureEvent = terminalSpanFailure(
      jobSpan, normalized, runtimeLogCauseEventId(normalized), "JOB_EXECUTION_FAILED",
    );
    await handleClaimFailure({
      state, job, accepted, error: normalized, parentSpanId: jobSpan.spanId,
      causeEventId: failureEvent.eventId,
    });
  }
};
