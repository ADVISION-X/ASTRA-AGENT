import { executionFailure, type SerializedExecutionFailure } from "../../typed-failure.js";
import type { DurablePluginIdentity, WebsiteAgentResult, WebsiteAgentTask } from "./contracts.js";
import { WebsiteAgentResultSchema, type ProductionHash } from "./contracts.js";
import { isRejectedCheckpointSequenceFailure } from "./store-outbox-recovery-proof.js";
import { ProductionStoreContinuationState } from "./store-continuation-state.js";
import {
  isSerializedTerminalFailure,
  json,
  now,
  storedTaskFromRow,
  type ProductionCheckpointAuthority,
  type ProductionLeaseAuthority,
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

export abstract class ProductionStoreTaskState extends ProductionStoreContinuationState {
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
        this.database.transaction(() => {
          this.database.prepare(
            "update production_continuations set lane_owner_job_id=null where lane_owner_job_id=?",
          ).run(task.job_id);
          this.database.prepare(`update production_tasks
            set current_attempt_id=?,current_reason='LEASE_GRANTED',updated_at=?
            where job_id=? and status='failed'`).run(attemptId, now(), task.job_id);
        })();
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

  public readGptContinuationExecutionBinding(jobId: string) {
    const stored = this.readTask(jobId);
    return stored ? Object.freeze({
      job_id: jobId,
      plugin_id: stored.identity.plugin_id,
      plugin_version: stored.identity.plugin_version,
      owner_ref: stored.task.business_identity.owner_ref,
      subject_ref: stored.task.business_identity.subject_ref,
      authorization_ref: stored.task.business_identity.authorization_ref,
    }) : null;
  }

  public attemptIdsForTask(jobId: string): readonly string[] {
    const rows = this.database.prepare(`select attempt_id from production_attempt_failures where job_id=?
      union select current_attempt_id as attempt_id from production_tasks where job_id=?
      order by attempt_id`).all(jobId, jobId) as Array<{ attempt_id: string }>;
    return Object.freeze(rows.map((row) => row.attempt_id));
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
      where job_id=? and attempt_id=?`
    ).get(jobId, attemptId) as { failure_json: string } | undefined;
    if (first && first.failure_json !== serialized) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_IMMUTABLE");
    }
    this.database.transaction(() => {
      this.database.prepare(`insert into production_attempt_failures(job_id,attempt_id,failure_json,created_at)
        values(?,?,?,?) on conflict(job_id,attempt_id) do nothing`).run(
        jobId, attemptId, serialized, now(),
      );
      this.database.prepare(`update production_tasks set current_reason=?,updated_at=?
        where job_id=? and status='failed'`).run(failure.code.slice(0, 1_000), now(), jobId);
    })();
  }

  protected removeRejectedCheckpointFalseFailure(input: Readonly<{
    jobId: string;
    attemptId: string;
    failure: SerializedExecutionFailure;
  }>): void {
    if (!isRejectedCheckpointSequenceFailure(input.failure)) {
      throw executionFailure("failed", "PRODUCTION_RECOVERY_FAILURE_SHAPE_MISMATCH");
    }
    const task = this.database.prepare(`select current_attempt_id from production_tasks
      where job_id=? and status='failed'`).get(input.jobId) as { current_attempt_id: string } | undefined;
    if (!task || task.current_attempt_id !== input.attemptId) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_AUTHORITY_CONFLICT");
    }
    const changed = this.database.prepare(`delete from production_attempt_failures
      where job_id=? and attempt_id=? and failure_json=?`).run(
      input.jobId, input.attemptId, json(input.failure),
    );
    if (changed.changes !== 1) throw executionFailure("failed", "PRODUCTION_ATTEMPT_AUTHORITY_CONFLICT");
    this.database.prepare(`update production_tasks set current_reason='REMOTE_CHECKPOINT_PREFIX_RECONCILED',
      updated_at=? where job_id=? and status='failed'`).run(now(), input.jobId);
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
