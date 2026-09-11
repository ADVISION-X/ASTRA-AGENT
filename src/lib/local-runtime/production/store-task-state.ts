import { executionFailure } from "../../execution-failure.js";
import type { SerializedExecutionFailure } from "./terminal-failure.js";
import type { DurablePluginIdentity, WebsiteAgentResult, WebsiteAgentTask } from "./contracts.js";
import { WebsiteAgentResultSchema } from "./contracts.js";
import { ProductionStoreFoundation } from "./store-foundation.js";
import {
  productionLeaseAuthorityFromRow,
  productionTaskRowValid,
  type ProductionLeaseAuthorityRow,
} from "./store-authority-validation.js";
import {
  isSerializedTerminalFailure,
  json,
  now,
  storedTaskFromRow,
  type ProductionLeaseAuthority,
  type StoredProductionTask,
  type TaskRow,
} from "./store-foundation.js";

const endedJobPathMarker = (jobId: string): string => `/jobs/${encodeURIComponent(jobId)}/`;

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
const taskAuthorityFromRow = (row: TaskRow): StoredProductionTask => {
  const record = storedTaskFromRow(row);
  if (!productionTaskRowValid(row, record)) {
    throw executionFailure("failed", "PRODUCTION_TASK_AUTHORITY_CORRUPT");
  }
  return record;
};

export abstract class ProductionStoreTaskState extends ProductionStoreFoundation {
  public endUnsentAttemptWrites(jobId: string): number {
    const changed = this.database.prepare(`update production_outbox
      set last_error='ATTEMPT_ENDED'
      where instr(path,?)>0 and sent_at is null`
    ).run(endedJobPathMarker(jobId));
    this.notifyOutbox(null);
    return changed.changes;
  }

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
      if (existing.current_attempt_id === attemptId) {
        if (existing.status !== "failed"
          || existing.identity.plugin_id !== identity.plugin_id
          || existing.identity.plugin_version !== identity.plugin_version
          || existing.identity.skill_hash !== identity.skill_hash
          || existing.identity.request_hash !== identity.request_hash) {
          throw executionFailure("failed", "PRODUCTION_ACCEPTED_ATTEMPT_IDENTITY_CONFLICT");
        }
        this.database.prepare(`update production_tasks
          set current_reason='LEASE_REGRANTED',updated_at=?
          where job_id=? and status='failed' and current_attempt_id=?`).run(
          now(), task.job_id, attemptId,
        );
        return this.readTask(task.job_id)!;
      }
      if (existing.status === "failed") {
        this.database.transaction(() => {
          this.endUnsentAttemptWrites(task.job_id);
          this.database.prepare("delete from production_leases where job_id=?").run(task.job_id);
          this.database.prepare(`update production_tasks
            set identity_json=?,current_attempt_id=?,current_reason='LEASE_GRANTED',
              staged_result_json=null,attempt_failure_json=null,updated_at=?
            where job_id=? and status='failed'`).run(json(identity), attemptId, now(), task.job_id);
        })();
        return this.readTask(task.job_id)!;
      }
      throw executionFailure("failed", "PRODUCTION_TASK_IDENTITY_CONFLICT");
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
      `select t.job_id,t.request_hash,t.task_json,t.identity_json,t.status,t.result_json,t.staged_result_json,
        t.attempt_failure_json,t.current_attempt_id,t.current_reason,t.updated_at
       from production_tasks t where t.job_id=?`,
    ).get(jobId) as TaskRow | undefined;
    return row ? taskAuthorityFromRow(row) : null;
  }

  public taskAuthorities(): readonly StoredProductionTask[] {
    const rows = this.database.prepare(
      `select t.job_id,t.request_hash,t.task_json,t.identity_json,t.status,t.result_json,t.staged_result_json,
        t.attempt_failure_json,t.current_attempt_id,t.current_reason,t.updated_at
       from production_tasks t order by t.updated_at,t.job_id`,
    ).all() as TaskRow[];
    return rows.map(taskAuthorityFromRow);
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

  public discardStagedResult(jobId: string, reason: string): void {
    const changed = this.database.prepare(`update production_tasks
      set staged_result_json=null,current_reason=?,updated_at=?
      where job_id=? and status='failed' and staged_result_json is not null`
    ).run(reason, now(), jobId);
    if (changed.changes !== 1) {
      throw executionFailure("failed", "PRODUCTION_STAGED_RESULT_NOT_CURRENT");
    }
    this.endUnsentAttemptWrites(jobId);
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
    const rows = this.database.prepare(`select job_id,request_hash,task_json,identity_json,status,result_json,
      staged_result_json,attempt_failure_json,current_attempt_id,current_reason,updated_at from production_tasks
      where status='failed' and staged_result_json is not null order by updated_at,job_id`).all() as TaskRow[];
    return rows.map(taskAuthorityFromRow);
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
    const first = this.database.prepare("select attempt_failure_json from production_tasks where job_id=?")
      .get(jobId) as { attempt_failure_json: string | null } | undefined;
    if (first?.attempt_failure_json && first.attempt_failure_json !== serialized) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_IMMUTABLE");
    }
    this.database.prepare(`update production_tasks
      set attempt_failure_json=coalesce(attempt_failure_json,?),current_reason=?,updated_at=?
      where job_id=? and status='failed' and current_attempt_id=?`).run(
      serialized, failure.code.slice(0, 1_000), now(), jobId, attemptId,
    );
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
    const row = this.database.prepare(`select l.job_id,l.attempt_id,l.lease_version,l.fence_hash,l.state,l.expires_at,
      l.updated_at,t.current_attempt_id as task_attempt_id from production_leases l
      join production_tasks t on t.job_id=l.job_id where l.job_id=?`).get(jobId) as
      ProductionLeaseAuthorityRow | undefined;
    return row ? productionLeaseAuthorityFromRow(row, jobId) : null;
  }
}
