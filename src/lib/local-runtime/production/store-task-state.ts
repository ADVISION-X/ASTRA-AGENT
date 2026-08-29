import { executionFailure, type SerializedExecutionFailure } from "../../typed-failure.js";
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
  isSerializedTerminalFailure,
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
    throw executionFailure("failed", "PRODUCTION_RESULT_DURABLE_IDENTITY_MISMATCH");
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
    throw executionFailure("failed", "GPT_TURN_CHECKPOINT_INVALID");
  }
  return parsed as GptTurnDurableCheckpoint;
};

export abstract class ProductionStoreTaskState extends ProductionStoreFoundation {
  public acceptTask(
    task: WebsiteAgentTask,
    identity: DurablePluginIdentity,
    attemptId: string,
  ): StoredProductionTask {
    const existing = this.readTask(task.job_id);
    if (existing) {
      if (existing.task.request_hash !== task.request_hash) {
        throw executionFailure("failed", "PRODUCTION_TASK_REQUEST_HASH_CONFLICT");
      }
      if (json(existing.identity) !== json(identity)) {
        throw executionFailure("failed", "PRODUCTION_TASK_IDENTITY_CONFLICT");
      }
      if (existing.status === "failed" && existing.current_attempt_id !== attemptId) {
        if (existing.staged_result) throw executionFailure("failed", "PRODUCTION_NEW_ATTEMPT_AFTER_STAGED_RESULT");
        this.database.prepare(`update production_tasks
          set current_attempt_id=?,current_reason='LEASE_GRANTED',updated_at=?
          where job_id=? and status='failed'`).run(attemptId, now(), task.job_id);
        return this.readTask(task.job_id)!;
      }
      return existing;
    }
    const timestamp = now();
    this.database.prepare(`insert into production_tasks(
      job_id,request_hash,task_json,identity_json,status,current_attempt_id,current_reason,created_at,updated_at
    ) values(?,?,?,?,?,?,?,?,?)`).run(
      task.job_id, task.request_hash, json(task), json(identity), "failed", attemptId,
      "LEASE_GRANTED", timestamp, timestamp,
    );
    return this.readTask(task.job_id)!;
  }

  public readTask(jobId: string): StoredProductionTask | null {
    const row = this.database.prepare(
      `select t.task_json,t.identity_json,t.status,t.result_json,t.staged_result_json,t.current_attempt_id,
        t.current_reason,t.updated_at,(select f.failure_json from production_attempt_failures f
          where f.job_id=t.job_id and f.attempt_id=t.current_attempt_id) as attempt_failure_json
       from production_tasks t where t.job_id=?`,
    ).get(jobId) as TaskRow | undefined;
    return row ? storedTaskFromRow(row) : null;
  }

  public taskAuthorities(): readonly StoredProductionTask[] {
    const rows = this.database.prepare(
      `select t.task_json,t.identity_json,t.status,t.result_json,t.staged_result_json,t.current_attempt_id,
        t.current_reason,t.updated_at,(select f.failure_json from production_attempt_failures f
          where f.job_id=t.job_id and f.attempt_id=t.current_attempt_id) as attempt_failure_json
       from production_tasks t order by t.updated_at,t.job_id`,
    ).all() as TaskRow[];
    return rows.map(storedTaskFromRow);
  }

  public markExecuting(jobId: string): void {
    this.database.prepare(
      "update production_tasks set current_reason='EXECUTING',updated_at=? where job_id=? and status='failed'",
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
      throw executionFailure("failed", `PLUGIN_CHECKPOINT_INPUT_DRIFT:${stepId}`);
    }
    const checkpoint = parseGptTurnCheckpoint(row.result_json);
    if (checkpoint.input_hash !== inputHash) {
      throw executionFailure("failed", `PLUGIN_CHECKPOINT_INPUT_DRIFT:${stepId}`);
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
      throw executionFailure("failed", `GPT_TURN_CHECKPOINT_REGRESSION:${stepId}`);
    }
    if (durableCheckpoint.status === "success" && durableCheckpoint.mutation_state === "dispatched") {
      throw executionFailure("failed", `GPT_TURN_CHECKPOINT_MUTATION_UNSETTLED:${stepId}`);
    }
    this.database.prepare(`insert into production_steps(
      job_id,step_id,input_hash,result_json,completed_at
    ) values(?,?,?,?,?) on conflict(job_id,step_id) do update set
      input_hash=excluded.input_hash,result_json=excluded.result_json,completed_at=excluded.completed_at`
    ).run(jobId, stepId, durableCheckpoint.input_hash, json(durableCheckpoint), now());
    const readback = this.readGptTurnCheckpoint(jobId, stepId, checkpoint.input_hash);
    if (!readback || json(readback) !== json(durableCheckpoint)) {
      throw executionFailure("failed", `GPT_TURN_CHECKPOINT_READBACK_INVALID:${stepId}`);
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
    if (changed.changes !== 1) throw executionFailure("failed", "GPT_CONTINUATION_LANE_BUSY");
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
      throw executionFailure("failed", "GPT_CONTINUATION_ADVANCE_CAS_FAILED");
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
    if (accepted!.attempt_failure) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_ALREADY_FAILED");
    }
    if (accepted!.staged_result && json(accepted!.staged_result) !== json(result)) {
      throw executionFailure("failed", "PRODUCTION_STAGED_RESULT_CONFLICT");
    }
    const changed = this.database.prepare(`update production_tasks
      set staged_result_json=?,current_reason='BUSINESS_ADMISSION_PENDING',updated_at=?
      where job_id=? and status='failed'`).run(json(result), now(), jobId);
    if (changed.changes !== 1) {
      throw executionFailure("failed", "PRODUCTION_STAGED_RESULT_TERMINAL_CONFLICT");
    }
  }

  public completeTask(jobId: string, result: WebsiteAgentResult): void {
    WebsiteAgentResultSchema.parse(result);
    assertResultIdentity(this.readTask(jobId), result);
    const changed = this.database.prepare(`update production_tasks set status='completed',current_reason=null,
      result_json=?,staged_result_json=null,updated_at=?
      where job_id=? and status='failed'`).run(
      json(result), now(), jobId,
    );
    if (changed.changes === 0 && !sameCompletion(this.readTask(jobId), result)) {
      throw executionFailure("failed", "PRODUCTION_TASK_COMPLETION_CONFLICT");
    }
  }

  public pendingBusinessAdmissions(): readonly StoredProductionTask[] {
    const rows = this.database.prepare(`select task_json,identity_json,status,result_json,staged_result_json,
      current_attempt_id,current_reason,updated_at,(select f.failure_json from production_attempt_failures f
        where f.job_id=production_tasks.job_id and f.attempt_id=production_tasks.current_attempt_id)
        as attempt_failure_json from production_tasks
      where status='failed' and staged_result_json is not null order by updated_at,job_id`).all() as TaskRow[];
    return rows.map(storedTaskFromRow);
  }

  public setCurrentReason(jobId: string, reason: string): void {
    this.database.prepare(
      "update production_tasks set current_reason=?,updated_at=? where job_id=? and status='failed'",
    ).run(reason.slice(0, 1_000), now(), jobId);
  }

  public recordAttemptFailure(jobId: string, attemptId: string, failure: SerializedExecutionFailure): void {
    if (!isSerializedTerminalFailure(failure)) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_INVALID");
    }
    const existing = this.database.prepare(
      "select current_attempt_id from production_tasks where job_id=? and status='failed'",
    ).get(jobId) as { current_attempt_id: string } | undefined;
    if (!existing || existing.current_attempt_id !== attemptId) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_IDENTITY_MISMATCH");
    }
    const serialized = json(failure);
    const first = this.database.prepare(`select failure_json from production_attempt_failures
      where job_id=? and attempt_id=?`).get(jobId, attemptId) as { failure_json: string } | undefined;
    if (first && first.failure_json !== serialized) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_IMMUTABLE");
    }
    this.database.transaction(() => {
      this.database.prepare(`insert into production_attempt_failures(job_id,attempt_id,failure_json,created_at)
        values(?,?,?,?) on conflict(job_id,attempt_id) do nothing`).run(jobId, attemptId, serialized, now());
      this.database.prepare(`update production_tasks set current_reason=?,updated_at=?
        where job_id=? and status='failed'`).run(failure.code.slice(0, 1_000), now(), jobId);
    })();
  }

  public recordCheckpoint(authority: ProductionCheckpointAuthority): ProductionCheckpointAuthority {
    const task = this.readTask(authority.jobId);
    if (!task || task.status !== "failed" || task.current_attempt_id !== authority.attemptId) {
      throw executionFailure("failed", "PRODUCTION_CHECKPOINT_ATTEMPT_IDENTITY_MISMATCH");
    }
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
    const task = this.readTask(authority.jobId);
    if (!task || task.status !== "failed" || task.current_attempt_id !== authority.attemptId) {
      throw executionFailure("failed", "PRODUCTION_LEASE_ATTEMPT_IDENTITY_MISMATCH");
    }
    const existing = this.readLease(authority.jobId);
    if (existing?.attemptId === authority.attemptId && authority.leaseVersion < existing.leaseVersion) {
      throw executionFailure("failed", "PRODUCTION_LEASE_VERSION_REGRESSION");
    }
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
