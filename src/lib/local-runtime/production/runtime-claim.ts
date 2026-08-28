import { rm } from "node:fs/promises";
import path from "node:path";

import {
  executionFailure,
  failureCode,
  serializeTerminalFailure,
} from "../../typed-failure.js";
import {
  RuntimeFailureImpact,
  RuntimeRecovery,
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
import { productionCatalogHash, resolveProductionPlugin } from "./catalog.js";
import { hashCanonical, type ProductionHash, type WebsiteAgentTask } from "./contracts.js";
import type { ProductionExecutionLease } from "./executor.js";
import type { StoredProductionTask } from "./store.js";
import { websiteAgentTaskFromClaim, type ClaimedProductionTask } from "./transport-protocol.js";
import {
  checkpointWithLog,
  emitCheckpointAuthority,
  emitLeaseAuthority,
  emitRuntimeState,
  releaseLeaseWithLog,
  runRuntimeSpan,
  runRuntimeSpanSync,
  terminalSpanFailure,
} from "./runtime-logging.js";
import {
  checkpointAuthority,
  classifyFailure,
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
        outcome: "success", authorityRef: `production-lease:${job.job_id}`,
        authorityHash: hashCanonical(authority),
      }));
      emitLeaseAuthority(state, authority);
    } catch (error) {
      const authority = state.store.recordLease(leaseAuthority(job, "stale", null));
      const terminal = terminalSpanFailure(span, error, classifyFailure(error), runtimeLogCauseEventId(error),
        "LEASE_RENEW_FAILED", {
          authorityRef: `production-lease:${job.job_id}`, authorityHash: hashCanonical(authority),
        });
      emitLeaseAuthority(state, authority);
      throw withRuntimeLogCause(error, terminal.eventId);
    }
    const relative = Date.parse(receipt.lease_expires_at) - Date.parse(receipt.server_now);
    if (!Number.isFinite(relative) || relative < 30_000) {
      throw executionFailure("recovery_pending", "V6_RENEW_BUDGET_INVALID");
    }
    budget.expires_at_monotonic = performance.now() + relative - 10_000;
    budget.command_ttl_ms = Math.min(20_000, relative - 10_000);
    if (receipt.control_intent.intent !== "none") {
      abort.abort(`CONTROL_INTENT:${receipt.control_intent.intent}:${receipt.control_intent.reason_code ?? "none"}`);
    }
  }
  return tracked;
};

type ClaimFailureDecision = "FINAL_FAILED" | "RECONCILE_ONLY" | "RETRY_FROM_CHECKPOINT";

const claimFailureDecision = (
  job: ClaimedProductionTask,
  error: unknown,
): ClaimFailureDecision => {
  const terminal = serializeTerminalFailure(error);
  if (terminal.mutation_outcome === "dispatched") return "RECONCILE_ONLY";
  if (job.grant.attempt_mode === "reconciliation") return "RECONCILE_ONLY";
  const terminalCodes = new Set([
    "USER_CANCELLED",
    "CLAIMED_PLUGIN_IDENTITY_MISMATCH",
    "CAPABILITY_MANIFEST_CHANGED_BEFORE_ACCEPT",
    "PRODUCTION_TASK_REQUEST_HASH_CONFLICT",
  ]);
  return terminalCodes.has(terminal.code) ? "FINAL_FAILED" : "RETRY_FROM_CHECKPOINT";
};

const releaseUnacceptedClaim = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  error: unknown,
  spanId: string,
  causeEventId: string,
): Promise<void> => {
  await releaseLeaseWithLog(state, job, spanId,
    failureCode(error).startsWith("V6_DEADLINE_") ? "DEADLINE_BUDGET_EXHAUSTED" : "CAPABILITY_CHANGED_BEFORE_ACCEPT",
    causeEventId);
  emitRuntimeState({ state, traceId: job.job_id, stateKey: "job.lease", current: "absent" });
};

const persistRecoveryPending = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  error: unknown,
  decision: Exclude<ClaimFailureDecision, "FINAL_FAILED">,
  parentSpanId: string,
): Promise<void> => {
  const reason = safeReason(error);
  state.store.setRecoveryPending(job.job_id, reason);
  emitLeaseAuthority(state, state.store.recordLease(leaseAuthority(job, "stale", null)));
  try {
    await checkpointWithLog(state, job, parentSpanId, "recovery_pending", reason, {
      ...serializeTerminalFailure(error), decision,
    });
  } catch (checkpointError) {
    emitRuntimeState({ state, traceId: job.job_id, stateKey: "job.checkpoint", current: "failed" });
    state.lastErrorCode = failureCode(checkpointError, "CHECKPOINT_STORAGE_FAILED");
    state.lastErrorReason = safeReason(checkpointError);
  }
  const record = state.store.readTask(job.job_id)!;
  emitRuntimeState({
    state, traceId: job.job_id, stateKey: "job.lifecycle", current: "recovery_pending",
    authorityRef: `production-task:${job.job_id}`, authorityHash: hashCanonical(record),
  });
};

const finalizeFailedClaim = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  error: unknown,
  materialDir: string,
  parentSpanId: string,
  causeEventId: string,
): Promise<void> => {
  const failure = serializeTerminalFailure(error);
  const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: job.job_id, parentSpanId, boundaryId: job.grant.claim_batch_id,
    owner: "production-runtime", component: "production-runtime", operation: "job.terminal",
    typedIdentity: jobIdentity(job),
  }));
  let terminalRecord: StoredProductionTask;
  try {
    await terminalProductionTask(state.session, state.store, job, {
      status: "failed", failure, payload_hash: hashCanonical({ job_id: job.job_id, failure }),
      result_receipt_hashes: [],
    });
    state.store.setTerminal(job.job_id, "failed", failure, null);
    terminalRecord = state.store.readTask(job.job_id)!;
  } catch (terminalError) {
    state.store.setRecoveryPending(job.job_id, `TERMINAL_DEFERRED:${safeReason(terminalError)}`);
    const record = state.store.readTask(job.job_id)!;
    const terminal = requireRuntimeLogWrite(span.terminal({
      outcome: "failed", authorityRef: `production-task:${job.job_id}`, authorityHash: hashCanonical(record),
      failure: runtimeFailureFromError({
        error: terminalError, code: "JOB_TERMINAL_DEFERRED", responsibleOwner: "production-runtime",
        recovery: RuntimeRecovery.RETRY, impact: RuntimeFailureImpact.CONSEQUENTIAL, causedByEventId: causeEventId,
      }),
    }));
    emitRuntimeState({
      state, traceId: job.job_id, stateKey: "job.lifecycle", current: "recovery_pending",
      authorityRef: `production-task:${job.job_id}`, authorityHash: hashCanonical(record),
    });
    throw withRuntimeLogCause(terminalError, terminal.eventId);
  }
  requireRuntimeLogWrite(span.terminal({
    outcome: "success", authorityRef: `production-task:${job.job_id}`,
    authorityHash: hashCanonical(terminalRecord),
  }));
  emitRuntimeState({
    state, traceId: job.job_id, stateKey: "job.lifecycle", current: "failed",
    authorityRef: `production-task:${job.job_id}`, authorityHash: hashCanonical(terminalRecord),
  });
  emitLeaseAuthority(state, state.store.recordLease(leaseAuthority(job, "absent", null)));
  await rm(materialDir, { recursive: true, force: true });
};

const handleClaimFailure = async (input: Readonly<{
  state: RuntimeState;
  job: ClaimedProductionTask;
  materialDir: string;
  accepted: boolean;
  error: unknown;
  parentSpanId: string;
  causeEventId: string;
}>): Promise<void> => {
  const durable = input.accepted || input.state.store.readTask(input.job.job_id) !== null;
  if (!durable) return releaseUnacceptedClaim(
    input.state, input.job, input.error, input.parentSpanId, input.causeEventId,
  );
  const decision = claimFailureDecision(input.job, input.error);
  if (decision !== "FINAL_FAILED") return persistRecoveryPending(
    input.state, input.job, input.error, decision, input.parentSpanId,
  );
  return finalizeFailedClaim(
    input.state, input.job, input.error, input.materialDir, input.parentSpanId, input.causeEventId,
  );
};

const assertClaimIdentity = (job: ClaimedProductionTask, task: WebsiteAgentTask): void => {
  if (job.grant.capability_manifest_hash !== productionCatalogHash) {
    throw executionFailure("review_required", "CAPABILITY_MANIFEST_CHANGED_BEFORE_ACCEPT");
  }
  const plugin = resolveProductionPlugin(task.product_id, task.action_id).plugin;
  if (job.grant.expected_catalog_hash !== productionCatalogHash
    || job.grant.expected_plugin_id !== plugin.pluginId
    || job.grant.expected_plugin_version !== plugin.pluginVersion) {
    throw executionFailure("review_required", "CLAIMED_PLUGIN_IDENTITY_MISMATCH");
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
    span, action: () => state.executor.accept(task), failureCode: "DURABLE_ACCEPT_FAILED",
    success: (accepted) => ({
      authorityRef: `production-task:${job.job_id}`, authorityHash: hashCanonical(accepted),
    }),
  });
  if (record.status !== "accepted" && record.status !== "running" && record.status !== "recovery_pending") {
    throw new Error("PRODUCTION_TASK_ALREADY_TERMINAL");
  }
  emitLeaseAuthority(state, state.store.recordLease(leaseAuthority(job, "active", job.grant.lease_expires_at)));
  emitCheckpointAuthority(state, state.store.recordCheckpoint(checkpointAuthority(job, "none", null, null)));
  emitRuntimeState({
    state, traceId: job.job_id, stateKey: "job.lifecycle", current: record.status,
    authorityRef: `production-task:${job.job_id}`, authorityHash: hashCanonical(record),
  });
  state.store.markRunning(job.job_id);
  const running = state.store.readTask(job.job_id)!;
  emitRuntimeState({
    state, traceId: job.job_id, stateKey: "job.lifecycle", current: "running",
    authorityRef: `production-task:${job.job_id}`, authorityHash: hashCanonical(running),
  });
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
      const checkpoint = await checkpointWithLog(
        state, job, span.spanId, "inputs_downloading", "durable_plugin_accept",
      );
      const materials = await downloadProductionMaterials(state.session, job, materialDir);
      await checkpointWithLog(state, job, span.spanId, "factory_running", "materials_verified");
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
  const completed = await runRuntimeSpan({
    span, failureCode: "JOB_TERMINAL_FAILED", action: async () => {
      await terminalProductionTask(input.state.session, input.state.store, input.job, {
        status: "completed", failure: null, payload_hash: payloadHash,
        result_receipt_hashes: input.uploaded.artifact_receipts.map((receipt) => receipt.receipt_hash),
      });
      input.state.store.setTerminal(input.job.job_id, "completed", null, input.execution.result);
      return input.state.store.readTask(input.job.job_id)!;
    },
    success: (record) => ({
      authorityRef: `production-task:${input.job.job_id}`, authorityHash: hashCanonical(record),
    }),
  });
  emitRuntimeState({
    state: input.state, traceId: input.job.job_id, stateKey: "job.lifecycle", current: "completed",
    authorityRef: `production-task:${input.job.job_id}`, authorityHash: hashCanonical(completed),
  });
  emitLeaseAuthority(input.state, input.state.store.recordLease(leaseAuthority(input.job, "absent", null)));
  await rm(input.materialDir, { recursive: true, force: true });
  requireRuntimeLogWrite(input.jobSpan.terminal({
    outcome: "success", authorityRef: `production-task:${input.job.job_id}`,
    authorityHash: hashCanonical(completed),
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
      jobSpan, normalized, classifyFailure(normalized), runtimeLogCauseEventId(normalized), "JOB_EXECUTION_FAILED",
    );
    await handleClaimFailure({
      state, job, materialDir, accepted, error: normalized, parentSpanId: jobSpan.spanId,
      causeEventId: failureEvent.eventId,
    });
  }
};
