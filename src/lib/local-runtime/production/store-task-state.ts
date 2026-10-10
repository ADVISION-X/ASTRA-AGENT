import type { SourceAttemptHandoff } from "./source-readback-contract.js";
import { validSourceHandoff } from "./store-source-settlement.js";
import { ProductionStoreSourceReadback } from "./store-source-readback.js";
import { executionFailure } from "../../execution-failure.js";
import type { AttemptFailureFirstFact } from "./terminal-failure.js";
import { hashCanonical, type WebsiteAgentResult, type WebsiteAgentTask } from "./contracts.js";
import { WebsiteAgentResultSchema } from "./contracts.js";
import { productionOutboxAuthorityFromRow, productionTaskRowValid } from "./store-authority-validation.js";
import {
  isAttemptFailureFirstFact,
  json,
  now,
  storedTaskFromRow,
  terminalBodyAttemptId,
  type StoredProductionTask,
  type ProductionOutboxAuthorityRow,
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

const sourceHandoffManifestValid = (
  manifest: SourceAttemptHandoff, task: WebsiteAgentTask, attemptId: string,
  sourceAttemptId: string, sealHash: `sha256:${string}`,
): boolean => validSourceHandoff(manifest) && manifest.seal_hash === sealHash
  && manifest.source_task_hash === hashCanonical(task)
  && manifest.source_attempt_id === sourceAttemptId
  && attemptId !== sourceAttemptId;

export abstract class ProductionStoreTaskState extends ProductionStoreSourceReadback {
  public earliestTaskCreatedAt(): string | null {
    const row = this.database.prepare(`select created_at from production_tasks
      order by created_at,job_id limit 1`).get() as { created_at: string } | undefined;
    return row?.created_at ?? null;
  }

  public readAttemptFailureRaw(jobId: string): string | null {
    const row = this.database.prepare(`select attempt_failure_json from production_tasks where job_id=?`)
      .get(jobId) as { attempt_failure_json: string | null } | undefined;
    return row?.attempt_failure_json ?? null;
  }
  private supersedeUnsentWritesForWebsiteAttempt(jobId: string): number {
    const changed = this.database.prepare(`update production_outbox
      set last_error='WEBSITE_ATTEMPT_REPLACED'
      where instr(path,?)>0 and sent_at is null`
    ).run(jobPathMarker(jobId));
    this.notifyOutbox(null);
    return changed.changes;
  }

  /** The Website ended this attempt by refusing its delivered result: only its terminal row is left, the stage is gone. */
  public attemptClosedByWebsite(jobId: string, attemptId: string): boolean {
    const task = this.readTask(jobId);
    if (task?.status !== "failed" || task.current_attempt_id !== attemptId
      || task.staged_result !== null || task.attempt_failure) return false;
    const terminals = this.database.prepare(`select body_blob from production_outbox
      where instr(path,?)>0 and kind='terminal'`).all(jobPathMarker(jobId)) as Array<{ body_blob: Buffer }>;
    return terminals.some((row) => terminalBodyAttemptId(row.body_blob) === attemptId);
  }

  /** Obey the Website's refusal: drop the dead candidate so its seat is freed and a fresh attempt can replace it. */
  public closeAttemptRefusedByWebsite(jobId: string, attemptId: string, stagedHash: `sha256:${string}`): void {
    this.database.transaction(() => {
      const task = this.readTask(jobId);
      const changed = task?.status === "failed" && task.current_attempt_id === attemptId
        && !task.attempt_failure && task.staged_result !== null
        && hashCanonical(task.staged_result) === stagedHash
        ? this.database.prepare(`update production_tasks
            set staged_result_json=null,current_reason='WEBSITE_REFUSED_RESULT',updated_at=?
          where job_id=? and status='failed' and current_attempt_id=? and staged_result_json is not null`)
          .run(now(), jobId, attemptId)
        : null;
      if (changed?.changes !== 1) {
        throw executionFailure("failed", "PRODUCTION_REFUSED_RESULT_CLOSE_CONFLICT");
      }
      this.supersedeUnsentWritesForWebsiteAttempt(jobId);
    })();
  }

  public acceptTaskAfterSourceHandoff(
    task: WebsiteAgentTask,
    attemptId: string,
    sealHash: `sha256:${string}`,
  ): StoredProductionTask {
    this.database.transaction(() => {
      const current = this.readTask(task.job_id);
      const archived = this.database.prepare(`select source_attempt_id,issued_attempt_id,
          seal_hash,source_manifest_json,first_fact_raw,sealed_at
        from production_attempt_handoffs where job_id=? and seal_hash=?`).get(
        task.job_id, sealHash,
      ) as { source_attempt_id: string; issued_attempt_id: string | null;
        seal_hash: string | null; source_manifest_json: string | null;
        first_fact_raw: string | null; sealed_at: string | null } | undefined;
      if (!current || current.status !== "failed" || !archived
        || archived.source_manifest_json === null || archived.seal_hash !== sealHash
        || archived.sealed_at === null
        || current.task.request_hash !== task.request_hash
        || current.current_attempt_id !== archived.source_attempt_id
        || current.staged_result !== null
        || this.readAttemptFailureRaw(task.job_id) !== archived.first_fact_raw
        || (archived.issued_attempt_id !== null && archived.issued_attempt_id !== attemptId)) {
        throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
      }
      const manifest = JSON.parse(archived.source_manifest_json) as SourceAttemptHandoff;
      if (!sourceHandoffManifestValid(
        manifest, task, attemptId, archived.source_attempt_id, sealHash,
      )) {
        throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
      }
      const changed = this.database.prepare(`update production_tasks
        set current_attempt_id=?,current_reason='LEASE_GRANTED',
          staged_result_json=null,attempt_failure_json=null,updated_at=?
        where job_id=? and status='failed' and current_attempt_id=?
          and staged_result_json is null`).run(
        attemptId, now(), task.job_id, archived.source_attempt_id,
      );
      if (changed.changes !== 1) {
        throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_CONFLICT");
      }
      this.supersedeUnsentWritesForWebsiteAttempt(task.job_id);
      this.database.prepare(`update production_attempt_handoffs
        set issued_attempt_id=?,accepted_at=?
        where job_id=? and source_attempt_id=? and seal_hash=?`).run(
        attemptId, now(), task.job_id, archived.source_attempt_id, sealHash,
      );
    })();
    return this.readTask(task.job_id)!;
  }

  public acceptTask(
    task: WebsiteAgentTask,
    attemptId: string,
  ): StoredProductionTask {
    return this.database.transaction(() => {
    const existing = this.readTask(task.job_id);
    if (existing) {
      if (existing.task.request_hash !== task.request_hash) {
        throw executionFailure("failed", "PRODUCTION_TASK_REQUEST_HASH_CONFLICT");
      }
      if (existing.current_attempt_id === attemptId) {
        if (existing.status !== "failed") {
          throw executionFailure("failed", "PRODUCTION_ACCEPTED_ATTEMPT_IDENTITY_CONFLICT");
        }
        if (this.sourceAttemptClosed(task.job_id, attemptId)) {
          throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_REQUIRED");
        }
        if (existing.attempt_failure) {
          throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_REQUIRED");
        }
        const regranted = this.database.prepare(`update production_tasks
          set current_reason='LEASE_REGRANTED',updated_at=?
          where job_id=? and status='failed' and current_attempt_id=?`).run(
          now(), task.job_id, attemptId,
        );
        if (regranted.changes !== 1) {
          throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_REQUIRED");
        }
        return this.readTask(task.job_id)!;
      }
      if (existing.status === "failed") {
        if (!this.attemptClosedByWebsite(task.job_id, existing.current_attempt_id)) {
          throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_REQUIRED");
        }
        const replaced = this.database.prepare(`update production_tasks
          set current_attempt_id=?,current_reason='LEASE_GRANTED',updated_at=?
          where job_id=? and status='failed' and current_attempt_id=? and staged_result_json is null`).run(
          attemptId, now(), task.job_id, existing.current_attempt_id,
        );
        if (replaced.changes !== 1) {
          throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_REQUIRED");
        }
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
    })();
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
      if (current.current_attempt_id !== attemptId) {
        throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_RECONCILIATION_CONFLICT");
      }
      if (this.sourceAttemptClosed(task.job_id, attemptId)) {
        throw executionFailure("failed", "PRODUCTION_SOURCE_HANDOFF_REQUIRED");
      }
      this.database.prepare(`update production_tasks
        set current_reason='LEASE_REGRANTED',updated_at=?
        where job_id=? and status='failed' and current_attempt_id=? and attempt_failure_json=?`).run(
        now(), task.job_id, attemptId, json(expected),
      );
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
      `update production_tasks set current_reason='EXECUTING',updated_at=?
        where job_id=? and status='failed'`,
    ).run(now(), jobId);
  }


  protected stageResultInTerminalTransaction(
    jobId: string, attemptId: string, result: WebsiteAgentResult,
  ): void {
    WebsiteAgentResultSchema.parse(result);
    const accepted = this.readTask(jobId);
    assertResultIdentity(accepted, result);
    if (accepted!.current_attempt_id !== attemptId
      || this.sourceAttemptClosed(jobId, attemptId)) {
      throw executionFailure("failed", "PRODUCTION_RESULT_ATTEMPT_FENCED");
    }
    if (accepted!.staged_result && json(accepted!.staged_result) !== json(result)) {
      throw executionFailure("failed", "PRODUCTION_STAGED_RESULT_CONFLICT");
    }
    if (accepted!.staged_result) return;
    const changed = this.database.prepare(`update production_tasks
      set staged_result_json=?,current_reason='BUSINESS_ADMISSION_PENDING',updated_at=?
      where job_id=? and status='failed' and current_attempt_id=?
        and staged_result_json is null`
    ).run(json(result), now(), jobId, attemptId);
    if (changed.changes !== 1) {
      throw executionFailure("failed", "PRODUCTION_STAGED_RESULT_TERMINAL_CONFLICT");
    }
  }

  public completeTask(jobId: string, result: WebsiteAgentResult): void {
    WebsiteAgentResultSchema.parse(result);
    assertResultIdentity(this.readTask(jobId), result);
    this.database.transaction(() => {
      const changed = this.database.prepare(`update production_tasks set status='completed',current_reason=null,
        result_json=?,staged_result_json=null,attempt_failure_json=null,updated_at=?
        where job_id=? and status='failed' and staged_result_json=?`).run(
        json(result), now(), jobId, json(result),
      );
      if (changed.changes === 0 && !sameCompletion(this.readTask(jobId), result)) {
        throw executionFailure("failed", "PRODUCTION_TASK_COMPLETION_CONFLICT");
      }
      if (changed.changes === 1) {
        this.database.prepare(`update production_outbox set last_error='BUSINESS_ADMITTED'
          where instr(path,?)>0 and sent_at is null`
        ).run(jobPathMarker(jobId));
        this.database.prepare(`update production_outbox
          set last_error='BROWSER_CLEANUP_PENDING'
          where kind='terminal' and instr(path,?)>0
            and json_extract(cast(body_blob as text),'$.payload_hash')=?`
        ).run(jobPathMarker(jobId), hashCanonical(result));
      }
    })();
  }

  public pendingBrowserCleanupJobIds(): readonly string[] {
    const rows = this.database.prepare(`select * from production_outbox
      where kind='terminal' and last_error='BROWSER_CLEANUP_PENDING'`
    ).all() as ProductionOutboxAuthorityRow[];
    const jobs = rows.map((row) => {
      const jobId = productionOutboxAuthorityFromRow(row).jobId;
      if (!row.path.includes(jobPathMarker(jobId)) || this.readTask(jobId)?.status !== "completed") {
        throw executionFailure("failed", "PRODUCTION_BROWSER_CLEANUP_AUTHORITY_INVALID");
      }
      return jobId;
    });
    return Object.freeze([...new Set(jobs)].sort());
  }

  public settleBrowserCleanup(jobId: string): void {
    if (this.readTask(jobId)?.status !== "completed") {
      throw executionFailure("failed", "PRODUCTION_BROWSER_CLEANUP_TASK_NOT_COMPLETED");
    }
    const changed = this.database.prepare(`update production_outbox
      set last_error='BROWSER_CLEANUP_SETTLED'
      where kind='terminal' and instr(path,?)>0
        and last_error='BROWSER_CLEANUP_PENDING'`
    ).run(jobPathMarker(jobId));
    if (changed.changes === 0 && this.pendingBrowserCleanupJobIds().includes(jobId)) {
      throw executionFailure("failed", "PRODUCTION_BROWSER_CLEANUP_SETTLE_CONFLICT");
    }
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
      this.database.prepare("delete from production_attempt_handoffs where job_id=?").run(jobId);
      this.database.prepare("delete from production_tasks where job_id=?").run(jobId);
    });
    transaction();
    if (this.readTask(jobId) || this.database.prepare(
      "select 1 from production_attempt_handoffs where job_id=? limit 1",
    ).get(jobId) || this.database.prepare(
      "select 1 from production_outbox where instr(path,?)>0 limit 1",
    ).get(jobPathMarker(jobId))) {
      throw executionFailure("failed", "PRODUCTION_JOB_PURGE_INCOMPLETE");
    }
  }

  public setCurrentReason(jobId: string, reason: string): void {
    this.database.prepare(
      `update production_tasks set current_reason=?,updated_at=? where job_id=? and status='failed'`,
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
    return this.database.transaction(() => {
    if (this.sourceAttemptClosed(jobId, attemptId)) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_IDENTITY_MISMATCH");
    }
    const existing = this.database.prepare(`select current_attempt_id,attempt_failure_json
      from production_tasks where job_id=? and status='failed'`).get(jobId) as {
        current_attempt_id: string; attempt_failure_json: string | null;
      } | undefined;
    if (!existing || existing.current_attempt_id !== attemptId) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_IDENTITY_MISMATCH");
    }
    const serialized = json(failure);
    if (existing.attempt_failure_json && existing.attempt_failure_json !== serialized) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_IMMUTABLE");
    }
    const changed = this.database.prepare(`update production_tasks
      set attempt_failure_json=coalesce(attempt_failure_json,?),current_reason=?,updated_at=?
      where job_id=? and status='failed' and current_attempt_id=?`).run(
      serialized, failure.failure_core.code.slice(0, 1_000), now(), jobId, attemptId,
    );
    if (changed.changes !== 1) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_IDENTITY_MISMATCH");
    }
    const persisted = this.readTask(jobId);
    if (!persisted || json(persisted.attempt_failure) !== serialized) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_READBACK_MISMATCH");
    }
    return persisted;
    })();
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
    return this.database.transaction(() => {
    if (this.sourceAttemptClosed(jobId, replacement.release_descriptor.attempt_id)) {
      throw executionFailure("failed", "PRODUCTION_ATTEMPT_FAILURE_REBIND_CONFLICT");
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
    })();
  }
}
