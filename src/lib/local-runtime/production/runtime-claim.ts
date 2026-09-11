import { join } from "node:path";

import {
  executionFailure,
  failureCode,
  typedExecutionFailure,
} from "../../execution-failure.js";
import { serializeTerminalFailure, terminalFailureHttpStatus } from "./terminal-failure.js";
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
  uploadProductionGeneratedImage,
  uploadProductionResult,
} from "./cloud-client.js";
import { readProductionDeviceJobStatus } from "./cloud-reconciliation-client.js";
import { productionCatalogHash } from "./catalog.js";
import { authorizeWebsiteAgentTask } from "../../../mediator/agent-production-route.js";
import { hashCanonical, type WebsiteAgentTask } from "./contracts.js";
import type { ProductionExecutionLease } from "./contracts.js";
import {
  heartbeatWhileRunning,
  ProductionRuntimeBoundaryError,
} from "./runtime-execution-heartbeat.js";
import type { StoredProductionTask } from "./store.js";
import { websiteAgentTaskFromClaim, type ClaimedProductionTask } from "./transport-protocol.js";
import {
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
  permanentAuthorizationRevoked,
  settlePermanentAuthorizationRevocation,
} from "./runtime-permanent-revocation.js";
import { productionRuntimeTaskPath } from "./runtime-storage-inventory.js";
import { reconcileBusinessAdmission } from "./runtime-business-admission.js";

const isResultTransportBoundary = (error: unknown): boolean => {
  const typed = typedExecutionFailure(error);
  const httpStatus = terminalFailureHttpStatus(error);
  const code = typed?.code ?? "";
  return code === "CLOUD_TRANSPORT_UNAVAILABLE"
    || code === "PRODUCTION_OUTBOX_DELIVERY_BACKOFF_ACTIVE"
    || code === "AI_LEASE_FENCE_STALE" || code === "AI_V6_LEASE_RACE"
    || code === "AI_V6_JOB_NOT_FOUND"
    || code.startsWith("PRODUCTION_REMOTE_RECEIPT_")
    || code.startsWith("PRODUCTION_OUTBOX_")
    || (httpStatus !== null && httpStatus >= 500);
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
      attemptFailure: null,
    },
    causeEventId);
};

const persistAttemptFailure = async (
  state: RuntimeState,
  job: ClaimedProductionTask,
  error: unknown,
  parentSpanId: string,
): Promise<void> => {
  const failure = serializeTerminalFailure(error);
  state.store.recordLease(leaseAuthority(job, "stale", null));
  state.store.recordAttemptFailure(job.job_id, job.grant.attempt_id, failure);
  try {
    await releaseLeaseWithLog(state, job, parentSpanId, {
      reasonCode: "ATTEMPT_FAILED", attemptFailure: failure,
    }, runtimeLogCauseEventId(error) ?? parentSpanId);
  } catch (releaseError) {
    state.lastErrorCode = failureCode(releaseError, "LEASE_RELEASE_FAILED");
    state.lastErrorReason = safeReason(releaseError);
    return;
  }
};

const assertClaimIdentity = (job: ClaimedProductionTask, task: WebsiteAgentTask): void => {
  if (job.grant.capability_manifest_hash !== productionCatalogHash) {
    throw executionFailure("failed", "CAPABILITY_MANIFEST_CHANGED_BEFORE_ACCEPT");
  }
  const plugin = authorizeWebsiteAgentTask(task).identity;
  if (job.grant.expected_plugin_id !== plugin.plugin_id
    || job.grant.expected_plugin_version !== plugin.plugin_version) {
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
    span, failureCode: "MATERIAL_DOWNLOAD_VERIFY_FAILED",
    action: () => downloadProductionMaterials(state.session, job, materialDir),
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
      `ATTEMPT_ENDED:${failureCode(input.error, "PRODUCTION_RUNTIME_BOUNDARY_FAILED")}`,
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
  materials: Awaited<ReturnType<typeof downloadProductionMaterials>>;
  identity: StoredProductionTask["identity"];
  abort: AbortController;
  jobSpan: RuntimeSpanHandle;
}>) => {
  let uploaded: Awaited<ReturnType<typeof uploadProductionResult>> | undefined;
  let uploadBoundaryFailure: unknown | undefined;
  const generatedImageReceipts: Awaited<ReturnType<typeof uploadProductionGeneratedImage>>["transportReceipt"][] = [];
  let execution: Awaited<ReturnType<RuntimeState["executor"]["execute"]>>;
  try {
    execution = await heartbeatWhileRunning({
      state: input.state, job: input.job, budget: input.budget,
      execution: input.state.executor.execute(input.task, input.materials, input.budget, input.jobSpan.spanId,
        async (output) => {
        const span = requireRuntimeLogWrite(input.state.runtimeLogger.startSpan({
          traceId: input.job.job_id, parentSpanId: input.jobSpan.spanId, owner: "production-runtime",
          component: "production-result", operation: "result.upload", typedIdentity: jobIdentity(input.job),
        }));
        try {
          uploaded = await runRuntimeSpan({
            span, failureCode: "RESULT_UPLOAD_FAILED", action: () => uploadProductionResult({
              session: input.state.session, store: input.state.store, job: input.job,
              identity: input.identity, output,
              priorArtifactReceipts: generatedImageReceipts,
            }),
          });
        } catch (error) {
          if (isResultTransportBoundary(error)) uploadBoundaryFailure = error;
          throw error;
        }
        return uploaded.envelope;
        },
        async (artifact) => {
          const uploadedImage = await uploadProductionGeneratedImage(
            input.state.session, input.state.store, input.job, artifact,
          );
          generatedImageReceipts.push(uploadedImage.transportReceipt);
          return uploadedImage.receipt;
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
  const acceptance: { durable: "unknown" | "unaccepted" | "accepted" } = { durable: "unknown" };
  const materialDir = join(productionRuntimeTaskPath(state.dataDir, job.job_id), "materials");
  const jobSpan = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: job.job_id, boundaryId: job.grant.claim_batch_id, owner: "production-runtime",
    component: "production-runtime", operation: "job.execute", typedIdentity: jobIdentity(job),
  }));
  try {
    acceptance.durable = "unaccepted";
    const remote = await readProductionDeviceJobStatus(state.session, job.job_id);
    if (remote.status !== "failed" || remote.terminal_status !== null
      || remote.accepted_attempt_count !== job.grant.accepted_attempt_count) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_AUTHORITY_CONFLICT");
    }
    const claim = acceptClaim(state, job, abort, jobSpan);
    acceptance.durable = "accepted";
    state.store.markExecuting(job.job_id);
    const materials = await downloadClaimMaterials(state, job, materialDir, jobSpan);
    let result: Awaited<ReturnType<typeof executeAndUpload>>;
    try {
      result = await executeAndUpload({
        state, job, task: claim.task, budget: claim.budget,
        materials, identity: claim.record.identity, abort, jobSpan,
      });
    } catch (error) {
      if (error instanceof ProductionRuntimeBoundaryError) throw error.boundaryCause;
      if (permanentAuthorizationRevoked(abort.signal)) {
        await settlePermanentAuthorizationRevocation(state, job, error, jobSpan);
        return;
      }
      terminalSpanFailure(
        jobSpan, error, runtimeLogCauseEventId(error), "JOB_EXECUTION_FAILED",
      );
      await persistAttemptFailure(state, job, error, jobSpan.spanId);
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
