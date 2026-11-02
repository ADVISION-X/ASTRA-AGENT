import type { SourceAttemptHandoff, SourceReadbackEffectProof } from "./source-readback-contract.js";
import {
  executionFailure, executionFailureMetadata, failureCode, typedExecutionFailure,
} from "../../execution-failure.js";
import { requireRuntimeLogWrite, type RuntimeSpanHandle } from "../../runtime-logs/index.js";
import {
  buildProductionLeaseRelease,
  downloadProductionMaterials,
  uploadProductionGeneratedImage, uploadProductionResult,
} from "./cloud-client.js";
import { buildTerminalProductionIntent, deliverTerminalProductionIntent } from "./cloud-terminal-intent.js";
import { productionCatalogHash } from "./catalog.js";
import { hashCanonical, type ProductionExecutionLease, type WebsiteAgentTask, type WebsiteAgentResult } from "./contracts.js";
import { heartbeatWhileRunning, ProductionRuntimeBoundaryError } from "./runtime-execution-heartbeat.js";
import { releaseLeaseWithLog, runRuntimeSpan, runRuntimeSpanSync } from "./runtime-logging.js";
import { jobIdentity, safeReason, type RuntimeState } from "./runtime-state.js";
import { reconcileBusinessAdmission, websiteJobAbsent } from "./runtime-business-admission.js";
import { terminalFailureHttpStatus, type AttemptFailureFirstFact } from "./terminal-failure.js";
import { websiteAgentTaskFromClaim, type ClaimedProductionTask } from "./transport-protocol.js";
import type { CompleteProductionOutput } from "./store-complete-output.js";

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

const reusableCallsFor = (source: SourceAttemptHandoff | null) => {
  return source?.readback_proofs.filter((proof) =>
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
};

const assertReplayGrantMatchesSeal = (
  replay: ClaimedProductionTask["grant"]["delivery_priority_replay_grant"],
  sealed: SourceAttemptHandoff,
): void => {
  const exhaustedCalls = sealed.readback_proofs.filter((proof) =>
    proof.disposition === "replay_exhausted");
  if (sealed.readback_proofs.some(proof => proof.disposition === "unresolved"
      || proof.effects.some(effect => effect.unresolved !== undefined))
    || (sealed.kind === "delivery_priority_replay") !== (replay !== null)
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
};

/** Bind a source-handoff grant to its typed local seal; true when it regrants the issued attempt. */
const requireSourceGrantSeal = (
  state: RuntimeState, job: ClaimedProductionTask, sourceSeal: `sha256:${string}`,
): boolean => {
  const local = state.store.readTask(job.job_id);
  const issuedRegrant = job.grant.same_accepted_attempt
    && local?.current_attempt_id === job.grant.attempt_id;
  const sealed = issuedRegrant
    ? state.store.readIssuedSourceHandoff(job.job_id, job.grant.attempt_id, sourceSeal)
    : local?.current_attempt_id
      ? state.store.readSealedSourceHandoff(job.job_id, local.current_attempt_id) : null;
  if (!sealed || sealed.seal_hash !== sourceSeal) {
    throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_REQUIRED");
  }
  assertReplayGrantMatchesSeal(job.grant.delivery_priority_replay_grant, sealed);
  return issuedRegrant;
};

export const acceptClaim = (
  state: RuntimeState,
  job: ClaimedProductionTask,
  baseBudget: ProductionExecutionLease,
  jobSpan: RuntimeSpanHandle,
  reconciledFailure: AttemptFailureFirstFact | null,
  readbackOnlyCalls: readonly Readonly<{ productStepId: string; callId: string;
    childCapabilityId: "submit_exact_gpt_turn_once"; source?: Readonly<{ sourceAttemptId: string; sourceResultRevision: number; effectIdentityHash: `sha256:${string}`; walAuthorityHash: `sha256:${string}` }> }>[] | null,
) => {
  const task = websiteAgentTaskFromClaim(job);
  assertClaimIdentity(job);
  const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
    traceId: job.job_id, parentSpanId: jobSpan.spanId, owner: "production-runtime",
    component: "production-store", operation: "job.durable-accept", typedIdentity: jobIdentity(job),
  }));
  const record = runRuntimeSpanSync({
    span,
    action: () => {
      const sourceSeal = job.grant.source_handoff_seal_hash;
      if (sourceSeal !== null && !requireSourceGrantSeal(state, job, sourceSeal)) {
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
  const reusableCalls = reusableCallsFor(source).filter((call) => !readbackOnlyCalls?.some((readback) =>
    readback.productStepId === call.product_step_id && readback.callId === call.call_id
    && readback.childCapabilityId === call.child_capability_id));
  const budget: ProductionExecutionLease = {
    ...baseBudget,
    ...(readbackOnlyCalls ? { readback_only_calls: readbackOnlyCalls.map((call) => ({
      product_step_id: call.productStepId, call_id: call.callId,
      child_capability_id: call.childCapabilityId,
      ...(call.source ? { source: call.source } : {}),
    })) } : {}),
    ...(reusableCalls.length > 0 ? { source_reusable_calls: reusableCalls } : {}),
  };
  return { task, budget, record };
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

const sendStagedTerminal = async (input: Readonly<{ state: RuntimeState; job: ClaimedProductionTask;
  jobSpan: RuntimeSpanHandle; terminalIntent: ReturnType<typeof buildTerminalProductionIntent> }>): Promise<void> => {
  try {
    const span = requireRuntimeLogWrite(input.state.runtimeLogger.startSpan({
      traceId: input.job.job_id, parentSpanId: input.jobSpan.spanId, boundaryId: input.job.grant.claim_batch_id,
      owner: "production-runtime", component: "production-runtime", operation: "job.terminal", typedIdentity: jobIdentity(input.job),
    }));
    await runRuntimeSpan({ span, failureCode: "JOB_TERMINAL_FAILED", action: async () => {
      await deliverTerminalProductionIntent(input.state.session, input.state.store, input.terminalIntent);
      await reconcileBusinessAdmission(input.state, input.state.store.readTask(input.job.job_id)!);
      return input.state.store.readTask(input.job.job_id)!;
    }, success: record => ({ authorityRef: `production-task:${input.job.job_id}`, authorityHash: hashCanonical(record) }) });
  } catch (error) {
    input.state.lastErrorCode = failureCode(error, "JOB_TERMINAL_FAILED"); input.state.lastErrorReason = safeReason(error);
  }
};

type ExecuteAndUploadInput = Readonly<{
  state: RuntimeState; job: ClaimedProductionTask; task: WebsiteAgentTask;
  budget: ProductionExecutionLease;
  materialDir: string;
  abort: AbortController; jobSpan: RuntimeSpanHandle;
}>;

const downloadClaimMaterials = async (
  state: RuntimeState, job: ClaimedProductionTask, materialDir: string,
  jobSpan: RuntimeSpanHandle, signal: AbortSignal,
) => {
  try {
    const span = requireRuntimeLogWrite(state.runtimeLogger.startSpan({
      traceId: job.job_id, parentSpanId: jobSpan.spanId, owner: "production-runtime",
      component: "production-materials", operation: "material.download-verify", typedIdentity: jobIdentity(job),
    }));
    return await runRuntimeSpan({ span, failureCode: "MATERIAL_DOWNLOAD_VERIFY_FAILED",
      action: () => downloadProductionMaterials(state.session, job, materialDir, signal) });
  } catch (error) {
    throw new ProductionRuntimeBoundaryError(error);
  }
};

const uploadAndStageResult = async (input: ExecuteAndUploadInput,
  complete: CompleteProductionOutput) => {
  const span = requireRuntimeLogWrite(input.state.runtimeLogger.startSpan({
    traceId: input.job.job_id, parentSpanId: input.jobSpan.spanId, owner: "production-runtime",
    component: "production-result", operation: "result.upload", typedIdentity: jobIdentity(input.job),
  }));
  const uploaded = await runRuntimeSpan({ span, failureCode: "RESULT_UPLOAD_FAILED",
    action: () => uploadProductionResult({ session: input.state.session, store: input.state.store,
      job: input.job, complete }),
  });
  const terminalIntent = buildTerminalProductionIntent(input.state.session, input.job, {
    status: "completed", payload_hash: hashCanonical(uploaded.envelope),
    result_receipt_hashes: uploaded.artifact_receipts.map(receipt => receipt.receipt_hash),
    terminal_source_first_fact_raw: input.state.store.readAttemptFailureRaw(input.job.job_id),
  });
  input.state.store.stageResultAndEnqueueTerminal({ jobId: input.job.job_id,
    attemptId: input.job.grant.attempt_id, result: uploaded.envelope, terminal: terminalIntent.write });
  return { uploaded, terminalIntent };
};
export const executeAndUpload = async (input: ExecuteAndUploadInput): Promise<WebsiteAgentResult> => {
  let staged: Awaited<ReturnType<typeof uploadAndStageResult>> | undefined;
  let uploadBoundaryFailure: unknown;
  const imageReceipts: Awaited<ReturnType<typeof uploadProductionGeneratedImage>>["transportReceipt"][] = [];
  try {
    await heartbeatWhileRunning({ state: input.state, job: input.job, budget: input.budget,
      abort: input.abort, parentSpanId: input.jobSpan.spanId,
      execute: async stopAndJoinRenewal => {
        const materials = await downloadClaimMaterials(
          input.state, input.job, input.materialDir, input.jobSpan, input.abort.signal,
        );
        if (input.abort.signal.aborted) throw new ProductionRuntimeBoundaryError(input.abort.signal.reason);
        return input.state.executor.execute(input.task, materials, input.budget, input.jobSpan.spanId,
          async output => {
            const complete = input.state.store.preserveCompleteOutput(
              input.job.job_id, input.job.grant.attempt_id, output, imageReceipts);
            if (input.abort.signal.aborted) throw new ProductionRuntimeBoundaryError(input.abort.signal.reason);
            try { staged = await uploadAndStageResult(input, complete); }
            catch (error) { if (isResultTransportBoundary(error)) uploadBoundaryFailure = error; throw error; }
            await stopAndJoinRenewal();
            await sendStagedTerminal({ state: input.state, job: input.job, jobSpan: input.jobSpan,
              terminalIntent: staged.terminalIntent });
            return staged.uploaded.envelope;
          }, async artifact => {
            const uploaded = await uploadProductionGeneratedImage(input.state.session, input.state.store, input.job, artifact);
            imageReceipts.push(uploaded.transportReceipt);
            return uploaded.receipt;
          });
      },
    });
  } catch (error) {
    const durable = input.state.store.readTask(input.job.job_id);
    const result = durable?.staged_result ?? (durable?.status === "completed" ? durable.result : null);
    const authority = staged ? input.state.store.readOutboxAuthority(staged.terminalIntent.requestId) : null;
    if (staged && durable && result && authority?.jobId === input.job.job_id
      && durable.task.request_hash === input.task.request_hash && durable.current_attempt_id === input.job.grant.attempt_id
      && hashCanonical(result) === hashCanonical(staged.uploaded.envelope)) return staged.uploaded.envelope;
    if (uploadBoundaryFailure !== undefined) throw new ProductionRuntimeBoundaryError(uploadBoundaryFailure);
    throw error;
  }
  if (!staged) throw new Error("PLUGIN_RESULT_UPLOAD_MISSING");
  return staged.uploaded.envelope;
};

export const completeClaim = async (input: Readonly<{
  state: RuntimeState;
  job: ClaimedProductionTask;
  result: WebsiteAgentResult;
  jobSpan: RuntimeSpanHandle;
}>): Promise<void> => {
  const record = input.state.store.readTask(input.job.job_id)!;
  const result = record.staged_result ?? (record.status === "completed" ? record.result : null);
  if (record.current_attempt_id !== input.job.grant.attempt_id || !result
    || hashCanonical(result) !== hashCanonical(input.result)) throw executionFailure("failed", "PRODUCTION_TASK_COMPLETION_CONFLICT");
  await reconcileBusinessAdmission(input.state, record);
  const current = input.state.store.readTask(input.job.job_id)!;
  requireRuntimeLogWrite(input.jobSpan.terminal({
    outcome: "succeeded", authorityRef: `production-task:${input.job.job_id}`,
    authorityHash: hashCanonical(current),
  }));
};
