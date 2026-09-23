import { executionFailure } from "../../execution-failure.js";
import type { AttemptFailureFirstFact } from "./terminal-failure.js";
import type { WebsiteAgentResult, WebsiteAgentTask } from "./contracts.js";
import { WebsiteAgentResultSchema } from "./contracts.js";
import { ProductionStoreFoundation } from "./store-foundation.js";
import { productionTaskRowValid } from "./store-authority-validation.js";
import {
  isAttemptFailureFirstFact,
  json,
  now,
  storedTaskFromRow,
  type StoredProductionTask,
  type TaskRow,
} from "./store-foundation.js";

const jobPathMarker = (jobId: string): string => `/jobs/${encodeURIComponent(jobId)}/`;

const assertResultIdentity = (
  accepted: StoredProductionTask | null,
  result: WebsiteAgentResult,
): void => {
  if (!accepted || result.job_id !== accepted.task.job_id
    || result.source_task_id !== accepted.task.source_task_id
    || result.product_id !== accepted.task.product_id
    || result.action_id !== accepted.task.action_id) {
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
  private supersedeUnsentWritesForWebsiteAttempt(jobId: string): number {
    const changed = this.database.prepare(`update production_outbox
      set last_error='WEBSITE_ATTEMPT_REPLACED'
      where instr(path,?)>0 and sent_at is null`
    ).run(jobPathMarker(jobId));
    this.notifyOutbox(null);
    return changed.changes;
  }

  public acceptTask(
    task: WebsiteAgentTask,
    attemptId: string,
  ): StoredProductionTask {
    const existing = this.readTask(task.job_id);
    if (existing) {
      if (existing.task.request_hash !== task.request_hash) {
        throw executionFailure("failed", "PRODUCTION_TASK_REQUEST_HASH_CONFLICT");
      }
      if (existing.current_attempt_id === attemptId) {
        if (existing.status !== "failed") {
          throw executionFailure("failed", "PRODUCTION_ACCEPTED_ATTEMPT_IDENTITY_CONFLICT");
        }
        if (existing.attempt_failure) {
          throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_REQUIRED");
        }
        this.database.prepare(`update production_tasks
          set current_reason='LEASE_REGRANTED',updated_at=?
          where job_id=? and status='failed' and current_attempt_id=?`).run(
          now(), task.job_id, attemptId,
        );
        return this.readTask(task.job_id)!;
      }
      if (existing.status === "failed") {
        if (existing.attempt_failure) {
          throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_REQUIRED");
        }
        this.database.transaction(() => {
          this.supersedeUnsentWritesForWebsiteAttempt(task.job_id);
          this.database.prepare(`update production_tasks
            set current_attempt_id=?,current_reason='LEASE_GRANTED',
              staged_result_json=null,attempt_failure_json=null,updated_at=?
            where job_id=? and status='failed'`).run(attemptId, now(), task.job_id);
        })();
        return this.readTask(task.job_id)!;
      }
      throw executionFailure("failed", "PRODUCTION_TASK_IDENTITY_CONFLICT");
    }
    const timestamp = now();
    this.database.prepare(`insert into production_tasks(
      job_id,request_hash,task_json,status,current_attempt_id,current_reason,created_at,updated_at
    ) values(?,?,?,?,?,?,?,?)`).run(
      task.job_id, task.request_hash, json(task), "failed", attemptId,
      "LEASE_GRANTED", timestamp, timestamp,
    );
    return this.readTask(task.job_id)!;
  }

  public acceptTaskAfterFailureReconciled(
    task: WebsiteAgentTask,
    attemptId: string,
    expected: AttemptFailureFirstFact,
  ): StoredProductionTask {
    if (!isAttemptFailureFirstFact(expected)) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_INVALID");
    }
    const transaction = this.database.transaction(() => {
      const current = this.readTask(task.job_id);
      if (!current || current.status !== "failed"
        || current.task.request_hash !== task.request_hash
        || json(current.attempt_failure) !== json(expected)) {
        throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_CONFLICT");
      }
      if (current.current_attempt_id === attemptId) {
        this.database.prepare(`update production_tasks
          set current_reason='LEASE_REGRANTED',updated_at=?
          where job_id=? and status='failed' and current_attempt_id=? and attempt_failure_json=?`).run(
          now(), task.job_id, attemptId, json(expected),
        );
        return;
      }
      this.supersedeUnsentWritesForWebsiteAttempt(task.job_id);
      const changed = this.database.prepare(`update production_tasks
        set current_attempt_id=?,current_reason='LEASE_GRANTED',staged_result_json=null,
          attempt_failure_json=null,updated_at=?
        where job_id=? and status='failed' and attempt_failure_json=?`).run(
        attemptId, now(), task.job_id, json(expected),
      );
      if (changed.changes !== 1) {
        throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_CONFLICT");
      }
    });
    transaction();
    return this.readTask(task.job_id)!;
  }

  public readTask(jobId: string): StoredProductionTask | null {
    const row = this.database.prepare(
      `select t.job_id,t.request_hash,t.task_json,t.status,t.result_json,t.staged_result_json,
        t.attempt_failure_json,t.current_attempt_id,t.current_reason,t.updated_at
       from production_tasks t where t.job_id=?`,
    ).get(jobId) as TaskRow | undefined;
    return row ? taskAuthorityFromRow(row) : null;
  }

  public taskAuthorities(): readonly StoredProductionTask[] {
    const rows = this.database.prepare(
      `select t.job_id,t.request_hash,t.task_json,t.status,t.result_json,t.staged_result_json,
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

  public stageResultAfterProviderEffectReadback(
    jobId: string,
    result: WebsiteAgentResult,
    expected: AttemptFailureFirstFact,
  ): void {
    WebsiteAgentResultSchema.parse(result);
    if (!isAttemptFailureFirstFact(expected)
      || expected.failure_core.effect_scope !== "provider_effect"
      || !["dispatched", "confirmed"].includes(expected.failure_core.mutation_outcome)
      || expected.failure_core.provider_effect_identity_hash === null) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_INVALID");
    }
    const transaction = this.database.transaction(() => {
      const accepted = this.readTask(jobId);
      assertResultIdentity(accepted, result);
      if (json(accepted!.attempt_failure) !== json(expected)) {
        throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_CONFLICT");
      }
      if (accepted!.staged_result && json(accepted!.staged_result) !== json(result)) {
        throw executionFailure("failed", "PRODUCTION_STAGED_RESULT_CONFLICT");
      }
      const changed = this.database.prepare(`update production_tasks
        set attempt_failure_json=null,staged_result_json=?,
          current_reason='BUSINESS_ADMISSION_PENDING',updated_at=?
        where job_id=? and status='failed' and attempt_failure_json=?`).run(
        json(result), now(), jobId, json(expected),
      );
      if (changed.changes !== 1) {
        throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_CONFLICT");
      }
    });
    transaction();
  }

  public clearAttemptFailureForCurrentResult(
    jobId: string,
    expected: AttemptFailureFirstFact,
  ): void {
    if (!isAttemptFailureFirstFact(expected)) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_INVALID");
    }
    const changed = this.database.prepare(`update production_tasks
      set attempt_failure_json=null,current_reason='BUSINESS_ADMISSION_PENDING',updated_at=?
      where job_id=? and status='failed' and staged_result_json is not null
        and attempt_failure_json=?`).run(now(), jobId, json(expected));
    if (changed.changes !== 1 || this.readTask(jobId)?.attempt_failure !== null) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_CONFLICT");
    }
  }

  public completeTask(jobId: string, result: WebsiteAgentResult): void {
    WebsiteAgentResultSchema.parse(result);
    assertResultIdentity(this.readTask(jobId), result);
    const changed = this.database.prepare(`update production_tasks set status='completed',current_reason=null,
      result_json=?,staged_result_json=null,updated_at=?
      where job_id=? and status='failed' and attempt_failure_json is null`).run(
      json(result), now(), jobId,
    );
    if (changed.changes === 0 && !sameCompletion(this.readTask(jobId), result)) {
      throw executionFailure("failed", "PRODUCTION_TASK_COMPLETION_CONFLICT");
    }
  }

  public releaseAttemptForWebsiteDecision(jobId: string, attemptId: string): void {
    const transaction = this.database.transaction(() => {
      const current = this.readTask(jobId);
      if (!current || current.status !== "failed" || current.current_attempt_id !== attemptId) {
        throw executionFailure("failed", "PRODUCTION_ATTEMPT_RELEASE_IDENTITY_MISMATCH");
      }
      this.supersedeUnsentWritesForWebsiteAttempt(jobId);
      const changed = this.database.prepare(`update production_tasks
        set staged_result_json=null,current_reason='WAIT_NEW_ATTEMPT',updated_at=?
        where job_id=? and status='failed' and current_attempt_id=?`).run(now(), jobId, attemptId);
      if (changed.changes !== 1) {
        throw executionFailure("failed", "PRODUCTION_ATTEMPT_RELEASE_FAILED");
      }
    });
    transaction();
  }

  public pendingBusinessAdmissions(): readonly StoredProductionTask[] {
    const rows = this.database.prepare(`select job_id,request_hash,task_json,status,result_json,
      staged_result_json,attempt_failure_json,current_attempt_id,current_reason,updated_at from production_tasks
      where status='failed' and staged_result_json is not null
      order by updated_at,job_id`).all() as TaskRow[];
    return rows.map(taskAuthorityFromRow);
  }

  public pendingAttemptFailures(): readonly StoredProductionTask[] {
    const rows = this.database.prepare(`select job_id,request_hash,task_json,status,result_json,
      staged_result_json,attempt_failure_json,current_attempt_id,current_reason,updated_at from production_tasks
      where status='failed' and attempt_failure_json is not null
      order by updated_at,job_id`).all() as TaskRow[];
    return rows.map(taskAuthorityFromRow);
  }

  public unfinishedExecutionsWithoutReceipt(): readonly StoredProductionTask[] {
    const rows = this.database.prepare(`select job_id,request_hash,task_json,status,result_json,
      staged_result_json,attempt_failure_json,current_attempt_id,current_reason,updated_at from production_tasks
      where status='failed' and staged_result_json is null and attempt_failure_json is null
        and current_attempt_id is not null
      order by updated_at,job_id`).all() as TaskRow[];
    return rows.map(taskAuthorityFromRow);
  }

  public async purgeJob(jobId: string): Promise<void> {
    if (!jobId || /[\0]/u.test(jobId)) {
      throw executionFailure("failed", "PRODUCTION_STORAGE_JOB_ID_INVALID");
    }
    await this.outboxDeliveryTail;
    const transaction = this.database.transaction(() => {
      this.database.prepare("delete from production_outbox where instr(path,?)>0")
        .run(jobPathMarker(jobId));
      this.database.prepare("delete from production_tasks where job_id=?").run(jobId);
    });
    transaction();
    if (this.readTask(jobId) || this.database.prepare(
      "select 1 from production_outbox where instr(path,?)>0 limit 1",
    ).get(jobPathMarker(jobId))) {
      throw executionFailure("failed", "PRODUCTION_JOB_PURGE_INCOMPLETE");
    }
  }

  public setCurrentReason(jobId: string, reason: string): void {
    this.database.prepare(
      "update production_tasks set current_reason=?,updated_at=? where job_id=? and status='failed'",
    ).run(reason.slice(0, 1_000), now(), jobId);
  }

  public recordAttemptFailure(
    jobId: string,
    attemptId: string,
    failure: AttemptFailureFirstFact,
  ): StoredProductionTask {
    if (!isAttemptFailureFirstFact(failure)
      || failure.release_descriptor.attempt_id !== attemptId) {
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
      serialized, failure.failure_core.code.slice(0, 1_000), now(), jobId, attemptId,
    );
    const persisted = this.readTask(jobId);
    if (!persisted || json(persisted.attempt_failure) !== serialized) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_READBACK_MISMATCH");
    }
    return persisted;
  }

  public rebindAttemptFailureReleaseDescriptor(
    jobId: string,
    expected: AttemptFailureFirstFact,
    replacement: AttemptFailureFirstFact,
  ): StoredProductionTask {
    if (!isAttemptFailureFirstFact(expected) || !isAttemptFailureFirstFact(replacement)
      || json(expected.failure_core) !== json(replacement.failure_core)
      || expected.release_descriptor.attempt_id !== replacement.release_descriptor.attempt_id
      || replacement.release_descriptor.lease_version <= expected.release_descriptor.lease_version) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_REBIND_INVALID");
    }
    const changed = this.database.prepare(`update production_tasks
      set attempt_failure_json=?,current_reason=?,updated_at=?
      where job_id=? and status='failed' and current_attempt_id=? and attempt_failure_json=?`).run(
      json(replacement), replacement.failure_core.code.slice(0, 1_000), now(), jobId,
      replacement.release_descriptor.attempt_id, json(expected),
    );
    if (changed.changes !== 1) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_REBIND_CONFLICT");
    }
    const persisted = this.readTask(jobId);
    if (!persisted || json(persisted.attempt_failure) !== json(replacement)) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_READBACK_MISMATCH");
    }
    return persisted;
  }
}
