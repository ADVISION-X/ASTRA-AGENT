import { rmSync } from "node:fs";
import path from "node:path";

import { executionFailure } from "../../typed-failure.js";
import {
  GPT_TURN_FLOW_VERSION,
  type GptChildCapabilityId,
  type GptProviderContinuation,
  type StoredGptContinuation,
} from "../../../capabilities/gpt/index.js";
import type { DurablePluginIdentity, WebsiteAgentResult, WebsiteAgentTask } from "./contracts.js";
import { hashCanonical, WebsiteAgentResultSchema, type ProductionHash } from "./contracts.js";
import type { ProviderTurnResult } from "./plugin.js";
import type { GptTurnStateSnapshot } from "./gpt-turn-state.js";
import {
  ProductionStoreFoundation,
  json,
  now,
  storedTaskFromRow,
  type ProductionCheckpointAuthority,
  type ProductionLeaseAuthority,
  type StepRow,
  type StoredProductionTask,
  type TaskRow,
} from "./store-foundation.js";

const assertResultIdentity = (
  accepted: StoredProductionTask | null,
  result: WebsiteAgentResult,
): void => {
  if (!accepted || result.job_id !== accepted.task.job_id
    || result.source_task_id !== accepted.task.source_task_id
    || result.product_id !== accepted.task.product_id
    || result.action_id !== accepted.task.action_id
    || result.plugin_id !== accepted.identity.plugin_id
    || result.plugin_version !== accepted.identity.plugin_version) {
    throw executionFailure("review_required", "PRODUCTION_RESULT_DURABLE_IDENTITY_MISMATCH");
  }
};

const sameCompletion = (
  existing: StoredProductionTask | null,
  result: WebsiteAgentResult,
): boolean => Boolean(existing?.status === "completed" && json(existing.result) === json(result));

export type GptTurnDurableCheckpoint = Readonly<{
  schema_version: "gpt-turn-checkpoint.v2";
  flow_version: typeof GPT_TURN_FLOW_VERSION;
  input_hash: ProductionHash;
  step_index: number;
  child_capability_id: GptChildCapabilityId;
  status: "success" | "failed";
  mutation_state: "no" | "dispatched" | "confirmed";
  postcondition_result: "passed" | "failed" | "pending";
  evidence_ref: string;
  evidence_hash: ProductionHash;
  provider_dispatch_used: boolean;
  state: GptTurnStateSnapshot;
  result: ProviderTurnResult | null;
}>;

export type GptTurnCheckpointMetadata = Readonly<{
  inputHash: string;
  flowVersion: string;
  status: string;
  mutationState: string;
  hasResult: boolean;
}>;

const checkpointIdentityValid = (parsed: Partial<GptTurnDurableCheckpoint>): boolean =>
  parsed.schema_version === "gpt-turn-checkpoint.v2"
  && parsed.flow_version === GPT_TURN_FLOW_VERSION
  && typeof parsed.input_hash === "string"
  && /^sha256:[a-f0-9]{64}$/u.test(parsed.input_hash)
  && Number.isSafeInteger(parsed.step_index)
  && (parsed.step_index as number) >= 0
  && typeof parsed.child_capability_id === "string";

const checkpointProgressValid = (parsed: Partial<GptTurnDurableCheckpoint>): boolean =>
  (parsed.status === "success" || parsed.status === "failed")
  && ["no", "dispatched", "confirmed"].includes(String(parsed.mutation_state))
  && ["passed", "failed", "pending"].includes(String(parsed.postcondition_result))
  && typeof parsed.provider_dispatch_used === "boolean";

const checkpointEvidenceValid = (parsed: Partial<GptTurnDurableCheckpoint>): boolean =>
  typeof parsed.evidence_ref === "string"
  && parsed.evidence_ref.length > 0
  && typeof parsed.evidence_hash === "string"
  && /^sha256:[a-f0-9]{64}$/u.test(parsed.evidence_hash)
  && Boolean(parsed.state)
  && typeof parsed.state === "object"
  && !Array.isArray(parsed.state);

const parseGptTurnCheckpoint = (value: string): GptTurnDurableCheckpoint => {
  const parsed = JSON.parse(value) as Partial<GptTurnDurableCheckpoint>;
  if (!checkpointIdentityValid(parsed) || !checkpointProgressValid(parsed) || !checkpointEvidenceValid(parsed)) {
    throw executionFailure("review_required", "GPT_TURN_CHECKPOINT_INVALID");
  }
  return parsed as GptTurnDurableCheckpoint;
};

export abstract class ProductionStoreTaskState extends ProductionStoreFoundation {
  private reconstructExecutionSlice(
    task: WebsiteAgentTask,
    identity: DurablePluginIdentity,
    browserMutationPresent: boolean,
  ): StoredProductionTask {
    const jobPath = `%/jobs/${encodeURIComponent(task.job_id)}/%`;
    const safeRejectedCheckpointCodes = [
      "AI_LEASE_ACCEPT_DEADLINE_EXPIRED",
      "AI_V6_CHECKPOINT_TRANSITION_INVALID",
    ];
    const safe = this.database.prepare(`select
      t.status='recovery_pending' and t.result_json is null and t.staged_result_json is null
      and not exists(select 1 from production_steps s where s.job_id=t.job_id)
      and not exists(select 1 from production_continuations c where c.origin_job_id=t.job_id)
      and not exists(select 1 from production_leases l where l.job_id=t.job_id and l.state='active')
      and exists(
        select 1 from production_outbox retired
         where retired.path like ? and retired.failure_code='HISTORICAL_FAILED_COMPLETION_RETIRED'
      )
      and not exists(
        select 1 from production_outbox pending
         where pending.path like ? and pending.sent_at is null
           and not (pending.kind='checkpoint' and pending.failure_code in (?,?))
      ) as safe
      from production_tasks t where t.job_id=?`).get(
      jobPath, jobPath, safeRejectedCheckpointCodes[0], safeRejectedCheckpointCodes[1], task.job_id,
    ) as { safe: number } | undefined;
    if (!safe?.safe || browserMutationPresent) {
      throw executionFailure("review_required", "PLUGIN_EXECUTION_SLICE_RECONSTRUCTION_UNSAFE");
    }
    const existing = this.readTask(task.job_id)!;
    const oldIdentityHash = hashCanonical(existing.identity);
    const newIdentityHash = hashCanonical(identity);
    const recordedAt = now();
    const retiredCheckpointAttempts = this.database.prepare(`select
      idempotency_key as idempotencyKey,failure_code as failureCode,created_at as createdAt
      from production_outbox where path like ? and sent_at is null and kind='checkpoint'
        and failure_code in (?,?) order by created_at,idempotency_key`).all(
      jobPath, safeRejectedCheckpointCodes[0], safeRejectedCheckpointCodes[1],
    ) as Array<{ idempotencyKey: string; failureCode: string; createdAt: string }>;
    const reconstructionReceipt = {
      schema_version: "agent-execution-slice-reconstruction.v1",
      job_id: task.job_id,
      recorded_at: recordedAt,
      reason_code: "PLUGIN_IDENTITY_CHANGED_BEFORE_RECOVERY",
      disposition: "OLD_EXECUTION_SLICE_RETIRED",
      old_identity: existing.identity,
      old_identity_hash: oldIdentityHash,
      new_identity: identity,
      new_identity_hash: newIdentityHash,
      previous_failure: existing.failure,
      previous_failure_reason: existing.failure_reason,
      retired_checkpoint_attempts: retiredCheckpointAttempts,
    } as const;
    const receiptKey = `execution-slice-reconstructed:${hashCanonical({
      job_id: task.job_id, old_identity_hash: oldIdentityHash, new_identity_hash: newIdentityHash,
    })}`;
    this.database.prepare(`insert into production_outbox(
      idempotency_key,kind,path,method,headers_json,body_blob,created_at,sent_at,failure_code
    ) values(?,?,?,?,?,?,?,?,?)`).run(
      receiptKey, "checkpoint",
      `/internal/agent-production/jobs/${encodeURIComponent(task.job_id)}/execution-slice-reconstructions`,
      "POST", json({ "content-type": "application/json" }), Buffer.from(json(reconstructionReceipt)),
      recordedAt, recordedAt, "EXECUTION_SLICE_RECONSTRUCTED",
    );
    this.database.prepare(`update production_outbox
      set failure_code='EXECUTION_SLICE_RECONSTRUCTED',sent_at=coalesce(sent_at,?)
      where path like ? and sent_at is null and kind='checkpoint' and failure_code in (?,?)`
    ).run(recordedAt, jobPath, safeRejectedCheckpointCodes[0], safeRejectedCheckpointCodes[1]);
    this.database.prepare("delete from production_checkpoints where job_id=?").run(task.job_id);
    this.database.prepare("delete from production_leases where job_id=?").run(task.job_id);
    this.database.prepare(`update production_tasks set request_hash=?,task_json=?,identity_json=?,
      status='accepted',result_json=null,staged_result_json=null,failure_json=null,
      failure_reason=?,updated_at=? where job_id=?`).run(
      task.request_hash, json(task), json(identity),
      `EXECUTION_SLICE_RECONSTRUCTED:${oldIdentityHash}:${newIdentityHash}`,
      recordedAt, task.job_id,
    );
    rmSync(path.join(this.dataDir, "plugin-tasks", "production-runtime", task.job_id, "materials"), {
      recursive: true, force: true,
    });
    return this.readTask(task.job_id)!;
  }

  public acceptTask(
    task: WebsiteAgentTask,
    identity: DurablePluginIdentity,
    browserMutationPresent = false,
  ): StoredProductionTask {
    const existing = this.readTask(task.job_id);
    if (existing) {
      if (existing.task.request_hash !== task.request_hash) {
        throw executionFailure("review_required", "PRODUCTION_TASK_REQUEST_HASH_CONFLICT");
      }
      if (json(existing.identity) !== json(identity)) {
        const transaction = this.database.transaction(() =>
          this.reconstructExecutionSlice(task, identity, browserMutationPresent));
        return transaction();
      }
      return existing;
    }
    const timestamp = now();
    this.database.prepare(`insert into production_tasks(
      job_id,request_hash,task_json,identity_json,status,created_at,updated_at
    ) values(?,?,?,?,?,?,?)`).run(
      task.job_id, task.request_hash, json(task), json(identity), "accepted", timestamp, timestamp,
    );
    return this.readTask(task.job_id)!;
  }

  public readTask(jobId: string): StoredProductionTask | null {
    const row = this.database.prepare(
      "select task_json,identity_json,status,result_json,staged_result_json,failure_json,failure_reason,updated_at from production_tasks where job_id=?",
    ).get(jobId) as TaskRow | undefined;
    return row ? storedTaskFromRow(row) : null;
  }

  public taskAuthorities(): readonly StoredProductionTask[] {
    const rows = this.database.prepare(
      "select task_json,identity_json,status,result_json,staged_result_json,failure_json,failure_reason,updated_at from production_tasks order by updated_at,job_id",
    ).all() as TaskRow[];
    return rows.map(storedTaskFromRow);
  }

  public markRunning(jobId: string): void {
    this.database.prepare(
      "update production_tasks set status='running',failure_reason=null,updated_at=? where job_id=? and status in ('accepted','recovery_pending')",
    ).run(now(), jobId);
  }

  public readGptTurnCheckpoint(
    jobId: string,
    stepId: string,
    inputHash: ProductionHash,
  ): GptTurnDurableCheckpoint | null {
    const row = this.database.prepare(
      "select input_hash,result_json from production_steps where job_id=? and step_id=?",
    ).get(jobId, stepId) as StepRow | undefined;
    if (!row) return null;
    if (row.input_hash !== inputHash) {
      throw executionFailure("review_required", `PLUGIN_CHECKPOINT_INPUT_DRIFT:${stepId}`);
    }
    const checkpoint = parseGptTurnCheckpoint(row.result_json);
    if (checkpoint.input_hash !== inputHash) {
      throw executionFailure("review_required", `PLUGIN_CHECKPOINT_INPUT_DRIFT:${stepId}`);
    }
    return checkpoint;
  }

  public writeGptTurnCheckpoint(
    jobId: string,
    stepId: string,
    checkpoint: GptTurnDurableCheckpoint,
  ): void {
    const existing = this.readGptTurnCheckpoint(jobId, stepId, checkpoint.input_hash);
    const mutationRank = { no: 0, dispatched: 1, confirmed: 2 } as const;
    const durableCheckpoint = existing?.step_index === checkpoint.step_index
      && mutationRank[existing.mutation_state] > mutationRank[checkpoint.mutation_state]
      ? { ...checkpoint, mutation_state: existing.mutation_state }
      : checkpoint;
    if (existing && (existing.step_index > checkpoint.step_index
      || (existing.step_index === checkpoint.step_index
        && existing.status === "success" && checkpoint.status === "failed")
      || (existing.result && checkpoint.result && json(existing.result) !== json(checkpoint.result)))) {
      throw executionFailure("review_required", `GPT_TURN_CHECKPOINT_REGRESSION:${stepId}`);
    }
    if (durableCheckpoint.status === "success" && durableCheckpoint.mutation_state === "dispatched") {
      throw executionFailure("review_required", `GPT_TURN_CHECKPOINT_MUTATION_UNSETTLED:${stepId}`);
    }
    this.database.prepare(`insert into production_steps(
      job_id,step_id,input_hash,result_json,completed_at
    ) values(?,?,?,?,?) on conflict(job_id,step_id) do update set
      input_hash=excluded.input_hash,result_json=excluded.result_json,completed_at=excluded.completed_at`
    ).run(jobId, stepId, durableCheckpoint.input_hash, json(durableCheckpoint), now());
    const readback = this.readGptTurnCheckpoint(jobId, stepId, checkpoint.input_hash);
    if (!readback || json(readback) !== json(durableCheckpoint)) {
      throw executionFailure("review_required", `GPT_TURN_CHECKPOINT_READBACK_INVALID:${stepId}`);
    }
  }

  public readGptTurnCheckpointMetadata(jobId: string, stepId: string): GptTurnCheckpointMetadata | null {
    const row = this.database.prepare(
      "select input_hash,result_json from production_steps where job_id=? and step_id=?",
    ).get(jobId, stepId) as { input_hash: string; result_json: string } | undefined;
    if (!row) return null;
    let parsed: Readonly<Record<string, unknown>>;
    try { parsed = JSON.parse(row.result_json) as Readonly<Record<string, unknown>>; }
    catch { throw executionFailure("review_required", `GPT_TURN_CHECKPOINT_INVALID:${stepId}`); }
    return Object.freeze({
      inputHash: row.input_hash,
      flowVersion: typeof parsed.flow_version === "string" ? parsed.flow_version : "invalid",
      status: typeof parsed.status === "string" ? parsed.status : "invalid",
      mutationState: typeof parsed.mutation_state === "string" ? parsed.mutation_state : "invalid",
      hasResult: parsed.result !== null && parsed.result !== undefined,
    });
  }

  public reconstructStaleGptTurnStep(input: Readonly<{
    jobId: string;
    stepId: string;
    nextInputHash: ProductionHash;
    safeByBrowserWal: boolean;
  }>): void {
    const metadata = this.readGptTurnCheckpointMetadata(input.jobId, input.stepId);
    if (!metadata || metadata.flowVersion === GPT_TURN_FLOW_VERSION
      || metadata.status !== "failed" || metadata.hasResult || !input.safeByBrowserWal) {
      throw executionFailure("review_required", `GPT_FLOW_EXECUTION_SLICE_RECONSTRUCTION_UNSAFE:${input.stepId}`);
    }
    const task = this.readTask(input.jobId);
    if (!task || task.status === "completed" || task.result !== null || task.staged_result !== null) {
      throw executionFailure("review_required", `GPT_FLOW_EXECUTION_SLICE_RECONSTRUCTION_UNSAFE:${input.stepId}`);
    }
    const recordedAt = now();
    const receipt = {
      schema_version: "gpt-flow-execution-slice-reconstruction.v1",
      job_id: input.jobId,
      step_id: input.stepId,
      previous_flow_version: metadata.flowVersion,
      next_flow_version: GPT_TURN_FLOW_VERSION,
      previous_input_hash: metadata.inputHash,
      next_input_hash: input.nextInputHash,
      previous_mutation_state: metadata.mutationState,
      browser_wal_safety: "NO_DISPATCHED_OR_PROVIDER_EFFECT_TERMINAL",
      recorded_at: recordedAt,
    } as const;
    const receiptHash = hashCanonical(receipt);
    const localAcceptance = { accepted: true, receipt_hash: receiptHash } as const;
    const localAcceptanceHash = hashCanonical(localAcceptance);
    this.database.transaction(() => {
      this.database.prepare("delete from production_steps where job_id=? and step_id=?")
        .run(input.jobId, input.stepId);
      this.database.prepare(`insert into production_outbox(
        idempotency_key,kind,path,method,headers_json,body_blob,created_at,sent_at,failure_code,
        response_json,response_hash,receipt_hash
      ) values(?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        `gpt-flow-slice-reconstructed:${receiptHash}`,
        "checkpoint",
        `/internal/agent-production/jobs/${encodeURIComponent(input.jobId)}/gpt-flow-execution-slice-reconstructions`,
        "POST",
        json({ "content-type": "application/json" }),
        Buffer.from(json(receipt)),
        recordedAt,
        recordedAt,
        null,
        json(localAcceptance),
        localAcceptanceHash,
        receiptHash,
      );
    })();
    if (this.readGptTurnCheckpointMetadata(input.jobId, input.stepId) !== null) {
      throw executionFailure("review_required", `GPT_FLOW_EXECUTION_SLICE_RECONSTRUCTION_FAILED:${input.stepId}`);
    }
  }

  public countGptProviderDispatches(jobId: string): number {
    const rows = this.database.prepare(
      "select result_json from production_steps where job_id=?",
    ).all(jobId) as Array<{ result_json: string }>;
    return rows.reduce(
      (count, row) => count + (parseGptTurnCheckpoint(row.result_json).provider_dispatch_used ? 1 : 0),
      0,
    );
  }

  public createGptContinuation(continuation: StoredGptContinuation): void {
    this.database.prepare(`insert into production_continuations(
      continuation_ref,origin_job_id,plugin_id,owner_ref,subject_ref,authorization_ref,
      conversation_identity_hash,provider_json,lane_version,lane_owner_job_id,created_at
    ) values(?,?,?,?,?,?,?,?,?,?,?)`).run(
      continuation.continuation_ref, continuation.origin_job_id, continuation.plugin_id,
      continuation.owner_ref, continuation.subject_ref, continuation.authorization_ref,
      continuation.conversation_identity_hash, json(continuation.provider), continuation.lane_version,
      continuation.lane_owner_job_id, now(),
    );
  }

  public readGptContinuation(continuationRef: string): StoredGptContinuation | null {
    const row = this.database.prepare(`select continuation_ref,origin_job_id,plugin_id,owner_ref,subject_ref,
      authorization_ref,conversation_identity_hash,provider_json,lane_version,lane_owner_job_id
      from production_continuations where continuation_ref=?`).get(continuationRef) as
      | (Omit<StoredGptContinuation, "provider"> & { provider_json: string }) | undefined;
    return row ? { ...row, provider: JSON.parse(row.provider_json) as GptProviderContinuation } : null;
  }

  public acquireGptContinuationLane(continuationRef: string, ownerJobId: string): StoredGptContinuation {
    const changed = this.database.prepare(`update production_continuations
      set lane_owner_job_id=?,lane_version=case when lane_owner_job_id is null then lane_version+1 else lane_version end
      where continuation_ref=? and (lane_owner_job_id is null or lane_owner_job_id=?)`
    ).run(ownerJobId, continuationRef, ownerJobId);
    if (changed.changes !== 1) throw executionFailure("review_required", "GPT_CONTINUATION_LANE_BUSY");
    return this.readGptContinuation(continuationRef)!;
  }

  public advanceGptContinuationLane(input: Readonly<{
    continuationRef: string;
    ownerJobId: string;
    laneVersion: number;
    pluginId: string;
    provider: GptProviderContinuation;
    conversationIdentityHash: ProductionHash;
  }>): void {
    const changed = this.database.prepare(`update production_continuations
      set plugin_id=?,conversation_identity_hash=?,provider_json=?,lane_owner_job_id=null
      where continuation_ref=? and lane_owner_job_id=? and lane_version=?`).run(
      input.pluginId, input.conversationIdentityHash, json(input.provider), input.continuationRef,
      input.ownerJobId, input.laneVersion,
    );
    if (changed.changes !== 1) {
      throw executionFailure("review_required", "GPT_CONTINUATION_ADVANCE_CAS_FAILED");
    }
  }

  public releaseGptContinuationLane(continuationRef: string, ownerJobId: string, laneVersion: number): void {
    this.database.prepare(`update production_continuations set lane_owner_job_id=null
      where continuation_ref=? and lane_owner_job_id=? and lane_version=?`
    ).run(continuationRef, ownerJobId, laneVersion);
  }

  public stageResult(jobId: string, result: WebsiteAgentResult): void {
    WebsiteAgentResultSchema.parse(result);
    const accepted = this.readTask(jobId);
    assertResultIdentity(accepted, result);
    if (accepted!.staged_result && json(accepted!.staged_result) !== json(result)) {
      throw executionFailure("review_required", "PRODUCTION_STAGED_RESULT_CONFLICT");
    }
    const changed = this.database.prepare(`update production_tasks set staged_result_json=?,updated_at=?
      where job_id=? and status not in ('completed','review_required','failed','cancelled')`
    ).run(json(result), now(), jobId);
    if (changed.changes !== 1) {
      throw executionFailure("review_required", "PRODUCTION_STAGED_RESULT_TERMINAL_CONFLICT");
    }
  }

  public completeTask(jobId: string, result: WebsiteAgentResult): void {
    WebsiteAgentResultSchema.parse(result);
    assertResultIdentity(this.readTask(jobId), result);
    const changed = this.database.prepare(`update production_tasks set status='completed',failure_json=null,failure_reason=null,
      result_json=?,staged_result_json=null,updated_at=?
      where job_id=? and status not in ('completed','review_required','failed','cancelled')`).run(
      json(result), now(), jobId,
    );
    if (changed.changes === 0 && !sameCompletion(this.readTask(jobId), result)) {
      throw executionFailure("review_required", "PRODUCTION_TASK_COMPLETION_CONFLICT");
    }
  }

  public pendingBusinessAdmissions(): readonly StoredProductionTask[] {
    const rows = this.database.prepare(`select task_json,identity_json,status,result_json,staged_result_json,
      failure_json,failure_reason,updated_at from production_tasks
      where status='recovery_pending' and staged_result_json is not null order by updated_at,job_id`).all() as TaskRow[];
    return rows.map(storedTaskFromRow);
  }

  public setRecoveryPending(jobId: string, reason: string): void {
    this.database.prepare(
      "update production_tasks set status='recovery_pending',failure_reason=?,updated_at=? where job_id=? and status in ('accepted','running','recovery_pending')",
    ).run(reason.slice(0, 1_000), now(), jobId);
  }

  public recordCheckpoint(authority: ProductionCheckpointAuthority): ProductionCheckpointAuthority {
    this.database.prepare(`insert into production_checkpoints(
      job_id,attempt_id,checkpoint_id,checkpoint_hash,state,updated_at
    ) values(?,?,?,?,?,?) on conflict(job_id) do update set
      attempt_id=excluded.attempt_id,checkpoint_id=excluded.checkpoint_id,
      checkpoint_hash=excluded.checkpoint_hash,state=excluded.state,updated_at=excluded.updated_at`).run(
      authority.jobId, authority.attemptId, authority.checkpointId, authority.checkpointHash, authority.state, now(),
    );
    return this.readCheckpoint(authority.jobId)!;
  }

  public readCheckpoint(jobId: string): ProductionCheckpointAuthority | null {
    const row = this.database.prepare(`select job_id,attempt_id,checkpoint_id,checkpoint_hash,state
      from production_checkpoints where job_id=?`).get(jobId) as Readonly<{
      job_id: string; attempt_id: string; checkpoint_id: string | null;
      checkpoint_hash: ProductionHash | null; state: ProductionCheckpointAuthority["state"];
    }> | undefined;
    return row ? Object.freeze({
      jobId: row.job_id, attemptId: row.attempt_id, checkpointId: row.checkpoint_id,
      checkpointHash: row.checkpoint_hash, state: row.state,
    }) : null;
  }

  public recordLease(authority: ProductionLeaseAuthority): ProductionLeaseAuthority {
    this.database.prepare(`insert into production_leases(
      job_id,attempt_id,lease_version,fence_hash,state,expires_at,updated_at
    ) values(?,?,?,?,?,?,?) on conflict(job_id) do update set
      attempt_id=excluded.attempt_id,lease_version=excluded.lease_version,
      fence_hash=excluded.fence_hash,state=excluded.state,
      expires_at=excluded.expires_at,updated_at=excluded.updated_at`).run(
      authority.jobId, authority.attemptId, authority.leaseVersion, authority.fenceHash,
      authority.state, authority.expiresAt, now(),
    );
    return this.readLease(authority.jobId)!;
  }

  public readLease(jobId: string): ProductionLeaseAuthority | null {
    const row = this.database.prepare(`select job_id,attempt_id,lease_version,fence_hash,state,expires_at
      from production_leases where job_id=?`).get(jobId) as Readonly<{
      job_id: string; attempt_id: string; lease_version: number; fence_hash: ProductionHash;
      state: ProductionLeaseAuthority["state"]; expires_at: string | null;
    }> | undefined;
    return row ? Object.freeze({
      jobId: row.job_id, attemptId: row.attempt_id, leaseVersion: row.lease_version,
      fenceHash: row.fence_hash, state: row.state, expiresAt: row.expires_at,
    }) : null;
  }
}
