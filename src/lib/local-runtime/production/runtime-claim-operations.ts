import type { SourceReadbackEffectProof } from "./source-readback-contract.js";
import {
  executionFailure, executionFailureMetadata, failureCode, typedExecutionFailure,
} from "../../execution-failure.js";
import { requireRuntimeLogWrite, type RuntimeSpanHandle } from "../../runtime-logs/index.js";
import {
  buildProductionLeaseRelease, buildTerminalProductionIntent, deliverTerminalProductionIntent,
  downloadProductionMaterials,
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
  readbackOnlyCalls: readonly Readonly<{ productStepId: string; callId: string;
    childCapabilityId: "submit_exact_gpt_turn_once" }>[] | null,
) => {
  const task = websiteAgentTaskFromClaim(job);
  assertClaimIdentity(job);
  const baseBudget = leaseBudget(job, abort);
  const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: job.job_id, parentSpanId: jobSpan.spanId, owner: "production-runtime",
    component: "production-store", operation: "job.durable-accept", typedIdentity: jobIdentity(job),
  }));
  const record = runRuntimeSpanSync({
    span,
    action: () => {
      const local = state.store.readTask(job.job_id);
      const sourceSeal = job.grant.source_handoff_seal_hash;
      if (sourceSeal && local?.current_reason === `SOURCE_HANDOFF_SEALED|${sourceSeal}`) {
        const sealed = state.store.readSealedSourceHandoff(job.job_id, local.current_attempt_id!);
        const replay = job.grant.delivery_priority_replay_grant;
        const exhaustedCalls = sealed?.readback_proofs.filter((proof) =>
          proof.disposition === "replay_exhausted") ?? [];
        if (!sealed || (sealed.kind === "delivery_priority_replay") !== (replay !== null)
          || replay !== null && (exhaustedCalls.length !== replay.calls.length
            || exhaustedCalls.some((call, index) => {
              const issued = replay.calls[index];
              return !issued || call.product_step_id !== issued.product_step_id
                || call.call_id !== issued.call_id
                || call.child_capability_id !== issued.child_capability_id
                || call.source_effect_set_hash !== issued.source_effect_set_hash;
            }))) {
          throw executionFailure("failed", "PRODUCTION_REPLAY_GRANT_SOURCE_MISMATCH");
        }
        return state.executor.acceptAfterSourceHandoff(task, job.grant.attempt_id, sourceSeal);
      }
      return reconciledFailure
        ? state.executor.acceptAfterFailureReconciled(task, job.grant.attempt_id, reconciledFailure)
        : state.executor.accept(task, job.grant.attempt_id);
    },
    failureCode: "DURABLE_ACCEPT_FAILED",
    success: (accepted) => ({
      authorityRef: `production-task:${job.job_id}`, authorityHash: hashCanonical(accepted),
    }),
  });
  if (record.status !== "failed") {
    throw new Error("PRODUCTION_TASK_ALREADY_TERMINAL");
  }
  const replay = job.grant.delivery_priority_replay_grant;
  const source = replay ? state.store.readIssuedSourceHandoff(
    job.job_id, job.grant.attempt_id, replay.source_seal_hash,
  ) : null;
  if (replay && (!source || source.kind !== "delivery_priority_replay"
    || source.source_attempt_id !== replay.source_attempt_id)) {
    throw executionFailure("failed", "PRODUCTION_REPLAY_GRANT_SOURCE_MISMATCH");
  }
  const reusableCalls = source?.readback_proofs.filter((proof) =>
    proof.disposition === "settled_reusable").map((proof) => {
    const settled = proof.effects.filter((effect): effect is Extract<
      SourceReadbackEffectProof, { settled_checkpoint: object }
    > => effect.settled_checkpoint !== undefined)
      .sort((a, b) => b.settled_checkpoint.source_result_revision
        - a.settled_checkpoint.source_result_revision
        || a.effect_identity_hash.localeCompare(b.effect_identity_hash))[0];
    if (!settled) {
      throw executionFailure("failed", "PRODUCTION_SOURCE_CHECKPOINT_IDENTITY_MISMATCH");
    }
    return Object.freeze({
      product_step_id: proof.product_step_id, call_id: proof.call_id,
      child_capability_id: proof.child_capability_id,
      source_effect_set_hash: proof.source_effect_set_hash,
      source_attempt_id: settled.settled_checkpoint.source_attempt_id,
      source_result_revision: settled.settled_checkpoint.source_result_revision,
      effect_identity_hash: settled.effect_identity_hash,
      wal_authority_hash: settled.wal_authority_hash,
      checkpoint_exact_call_identity_hash:
        settled.settled_checkpoint.checkpoint_exact_call_identity_hash,
      artifact_ref: settled.settled_checkpoint.artifact_ref,
      artifact_content_hash: settled.settled_checkpoint.artifact_content_hash,
      submit_prompt_hash: settled.settled_checkpoint.submit_prompt_hash,
      canonical_conversation_hash: settled.settled_checkpoint.canonical_conversation_hash,
      user_turn_hash: settled.settled_checkpoint.user_turn_hash,
    });
  }) ?? [];
  const budget: ProductionExecutionLease = {
    ...baseBudget,
    ...(readbackOnlyCalls ? { readback_only_calls: readbackOnlyCalls.map((call) => ({
      product_step_id: call.productStepId, call_id: call.callId,
      child_capability_id: call.childCapabilityId,
    })) } : {}),
    ...(reusableCalls.length > 0 ? { source_reusable_calls: reusableCalls } : {}),
  };
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
  const boundaryFailureCode = failureCode(input.error);
  if ([
    "PRODUCTION_REMOTE_ATTEMPT_FAILURE_LOCAL_AUTHORITY_MISSING",
    "PRODUCTION_REGRANTED_ATTEMPT_LOCAL_AUTHORITY_MISSING",
  ].includes(boundaryFailureCode)) {
    input.state.lastErrorCode = boundaryFailureCode;
    input.state.lastErrorReason = safeReason(input.error);
    return;
  }
  if (input.job.grant.same_accepted_attempt) {
    input.state.lastErrorCode = boundaryFailureCode;
    input.state.lastErrorReason = safeReason(input.error);
    return;
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
  let terminalIntent: ReturnType<typeof buildTerminalProductionIntent> | undefined;
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
          terminalIntent = buildTerminalProductionIntent(input.state.session, input.job, {
            status: "completed", payload_hash: hashCanonical(uploaded.envelope),
            result_receipt_hashes: uploaded.artifact_receipts.map((receipt) => receipt.receipt_hash),
            terminal_source_first_fact_raw: input.state.store.readAttemptFailureRaw(input.job.job_id),
          });
          input.state.store.stageResultAndEnqueueTerminal({
            jobId: input.job.job_id, attemptId: input.job.grant.attempt_id,
            result: uploaded.envelope, terminal: terminalIntent.write,
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
    const durable = input.state.store.readTask(input.job.job_id);
    if (uploaded && terminalIntent && durable?.staged_result
      && durable.current_attempt_id === input.job.grant.attempt_id
      && hashCanonical(durable.staged_result) === hashCanonical(uploaded.envelope)
      && input.state.store.readOutboxAuthority(terminalIntent.requestId)) {
      execution = { record: durable, result: durable.staged_result,
        providerEffectReadbackProof: null };
    } else {
    if (uploadBoundaryFailure !== undefined) {
      throw new ProductionRuntimeBoundaryError(uploadBoundaryFailure);
    }
    throw error;
    }
  }
  if (!uploaded || !terminalIntent) throw new Error("PLUGIN_RESULT_UPLOAD_MISSING");
  return { execution, uploaded, terminalIntent };
};

export const completeClaim = async (input: Readonly<{
  state: RuntimeState;
  job: ClaimedProductionTask;
  execution: Awaited<ReturnType<RuntimeState["executor"]["execute"]>>;
  uploaded: Awaited<ReturnType<typeof uploadProductionResult>>;
  terminalIntent: ReturnType<typeof buildTerminalProductionIntent>;
  materialDir: string;
  jobSpan: RuntimeSpanHandle;
}>): Promise<void> => {
  const span = requireRuntimeLogWrite(input.state.runtimeLogger.startSpan({
    traceId: input.job.job_id, parentSpanId: input.jobSpan.spanId, boundaryId: input.job.grant.claim_batch_id,
    owner: "production-runtime", component: "production-runtime", operation: "job.terminal",
    typedIdentity: jobIdentity(input.job),
  }));
  await runRuntimeSpan({
    span, failureCode: "JOB_TERMINAL_FAILED", action: async () => {
      await deliverTerminalProductionIntent(
        input.state.session, input.state.store, input.terminalIntent,
      );
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
