import {
  executionFailure, executionFailureMetadata, failureCode, typedExecutionFailure,
} from "../../execution-failure.js";
import { requireRuntimeLogWrite, type RuntimeSpanHandle } from "../../runtime-logs/index.js";
import {
  buildProductionLeaseRelease, downloadProductionMaterials, terminalProductionTask,
  uploadProductionGeneratedImage, uploadProductionResult,
} from "./cloud-client.js";
import { productionCatalogHash } from "./catalog.js";
import { hashCanonical, type ProductionExecutionLease, type WebsiteAgentTask } from "./contracts.js";
import { heartbeatWhileRunning, ProductionRuntimeBoundaryError } from "./runtime-execution-heartbeat.js";
import { releaseLeaseWithLog, runRuntimeSpan, runRuntimeSpanSync } from "./runtime-logging.js";
import { jobIdentity, leaseBudget, safeReason, type RuntimeState } from "./runtime-state.js";
import { reconcileBusinessAdmission, websiteJobAbsent } from "./runtime-business-admission.js";
import { terminalFailureHttpStatus, type AttemptFailureFirstFact } from "./terminal-failure.js";
import { websiteAgentTaskFromClaim, type ClaimedProductionTask } from "./transport-protocol.js";

const isResultTransportBoundary = (error: unknown): boolean => {
  const typed = typedExecutionFailure(error);
  const httpStatus = terminalFailureHttpStatus(error);
  const code = typed?.code ?? "";
  return code === "CLOUD_TRANSPORT_UNAVAILABLE"
    || code === "PRODUCTION_OUTBOX_DELIVERY_BACKOFF_ACTIVE"
    || code === "AI_LEASE_FENCE_STALE" || code === "AI_V6_LEASE_RACE"
    || websiteJobAbsent(error)
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
  const release = buildProductionLeaseRelease(state.session, job, {
      reasonCode: failureCode(error).startsWith("V6_DEADLINE_")
        ? "LEASE_SAFETY_BUDGET_EXHAUSTED" : "CAPABILITY_CHANGED_BEFORE_ACCEPT",
      attemptFailure: null,
    });
  await releaseLeaseWithLog(state, job, spanId, release, causeEventId);
};

const assertClaimIdentity = (job: ClaimedProductionTask): void => {
  if (job.grant.capability_manifest_hash !== productionCatalogHash) {
    throw executionFailure("failed", "CAPABILITY_MANIFEST_CHANGED_BEFORE_ACCEPT");
  }
};

export const acceptClaim = (
  state: RuntimeState,
  job: ClaimedProductionTask,
  abort: AbortController,
  jobSpan: RuntimeSpanHandle,
  reconciledFailure: AttemptFailureFirstFact | null,
) => {
  const task = websiteAgentTaskFromClaim(job);
  assertClaimIdentity(job);
  const budget = leaseBudget(job, abort);
  const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: job.job_id, parentSpanId: jobSpan.spanId, owner: "production-runtime",
    component: "production-store", operation: "job.durable-accept", typedIdentity: jobIdentity(job),
  }));
  const record = runRuntimeSpanSync({
    span,
    action: () => reconciledFailure
      ? state.executor.acceptAfterFailureReconciled(task, job.grant.attempt_id, reconciledFailure)
      : state.executor.accept(task, job.grant.attempt_id),
    failureCode: "DURABLE_ACCEPT_FAILED",
    success: (accepted) => ({
      authorityRef: `production-task:${job.job_id}`, authorityHash: hashCanonical(accepted),
    }),
  });
  if (record.status !== "failed") {
    throw new Error("PRODUCTION_TASK_ALREADY_TERMINAL");
  }
  return { task, budget, record };
};

export const downloadClaimMaterials = async (
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

export const handleRuntimeBoundaryFailure = async (input: Readonly<{
  state: RuntimeState;
  job: ClaimedProductionTask;
  durability: "unknown" | "unaccepted" | "accepted";
  error: unknown;
  parentSpanId: string;
  causeEventId: string;
}>): Promise<void> => {
  const current = input.state.store.readTask(input.job.job_id);
  if (current?.status === "failed" && current.current_attempt_id === input.job.grant.attempt_id) {
    const evidence = executionFailureMetadata(input.error)?.evidence;
    input.state.store.setCurrentReason(
      input.job.job_id,
      [failureCode(input.error, "PRODUCTION_RUNTIME_BOUNDARY_FAILED"),
        evidence?.evidenceRef, evidence?.evidenceHash].filter(Boolean).join("|"),
    );
  }
  if (input.durability !== "unaccepted" || current?.attempt_failure) return;
  try {
    await releaseUnacceptedClaim(
      input.state, input.job, input.error, input.parentSpanId, input.causeEventId,
    );
  } catch (releaseError) {
    input.state.lastErrorCode = failureCode(releaseError, "LEASE_RELEASE_FAILED");
    input.state.lastErrorReason = safeReason(releaseError);
  }
};

export const executeAndUpload = async (input: Readonly<{
  state: RuntimeState;
  job: ClaimedProductionTask;
  task: WebsiteAgentTask;
  budget: ProductionExecutionLease;
  materials: Awaited<ReturnType<typeof downloadProductionMaterials>>;
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
              output,
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

const providerEffectProofHashMatches = (
  proof: Awaited<ReturnType<RuntimeState["executor"]["execute"]>>["providerEffectReadbackProof"],
): boolean => {
  if (!proof) return false;
  const { proof_hash: proofHash, ...proofBody } = proof;
  return hashCanonical(proofBody) === proofHash;
};

export const stageCompletedClaimResult = (input: Readonly<{
  store: RuntimeState["store"];
  job: ClaimedProductionTask;
  execution: Awaited<ReturnType<RuntimeState["executor"]["execute"]>>;
}>): void => {
  const pendingFailure = input.store.readTask(input.job.job_id)?.attempt_failure ?? null;
  if (pendingFailure) {
    const proof = input.execution.providerEffectReadbackProof;
    if (!proof || proof.schema_version !== "provider-effect-readback-proof.v1"
      || !providerEffectProofHashMatches(proof)
      || proof.job_id !== input.job.job_id
      || proof.attempt_id !== input.job.grant.attempt_id
      || proof.result_revision !== input.job.grant.result_revision
      || proof.provider_effect_identity_hash
        !== pendingFailure.failure_core.provider_effect_identity_hash
      || proof.browser_authority_ref !== pendingFailure.failure_core.evidence_ref
      || proof.browser_authority_hash !== pendingFailure.failure_core.evidence_hash
      || pendingFailure.failure_core.effect_scope !== "provider_effect"
      || !["dispatched", "confirmed"].includes(pendingFailure.failure_core.mutation_outcome)
      || proof.readback_provider_input_delta !== 0) {
      throw executionFailure("failed", "PROVIDER_EFFECT_READBACK_PROOF_INVALID");
    }
    input.store.stageResultAfterProviderEffectReadback(
      input.job.job_id, input.execution.result, pendingFailure,
    );
    return;
  }
  input.store.stageResult(input.job.job_id, input.execution.result);
};

export const completeClaim = async (input: Readonly<{
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
  stageCompletedClaimResult({ store: input.state.store, job: input.job, execution: input.execution });
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
  const record = input.state.store.readTask(input.job.job_id)!;
  await reconcileBusinessAdmission(input.state, record);
  const current = input.state.store.readTask(input.job.job_id)!;
  requireRuntimeLogWrite(input.jobSpan.terminal({
    outcome: "succeeded", authorityRef: `production-task:${input.job.job_id}`,
    authorityHash: hashCanonical(current),
  }));
};
